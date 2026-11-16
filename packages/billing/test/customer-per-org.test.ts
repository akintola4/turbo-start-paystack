import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { chargeSuccess, subscriptionCreate } from "../src/fixtures";
import {
  customerEmailCandidates,
  organizationTag,
  taggedEmail,
} from "../src/service/customer-email";
import { type BillingHarness, planCode, setupBilling } from "./support";

/*
 * Paystack keys customers by email and allows one active subscription per
 * customer and plan. One person with two organizations on the same plan
 * used to share a customer, so the second subscription was refused ("This
 * subscription is already in place.") and its card check never refunded.
 * Each organization now gets its own Paystack customer.
 */

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
const STARTER = "starter-monthly-ngn";
const PRO = "pro-monthly-ngn";
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
});

let n = 0;
async function person(local: string) {
  n += 1;
  const userId = `kola_user_${n}`;
  const email = `${local}.${n}@kolalogistics.test`;
  await h.db.insert(schema.user).values({ id: userId, name: local, email });
  return { userId, email, emailVerified: true };
}

async function orgFor(
  actor: { userId: string },
  slug: string,
  opts: { billingEmail?: string } = {}
) {
  n += 1;
  const organizationId = `kola_org_${n}`;
  await h.db
    .insert(schema.organization)
    .values({ id: organizationId, name: slug, slug: `${slug}-${n}` });
  await h.db.insert(schema.member).values({
    id: `kola_member_${n}`,
    organizationId,
    userId: actor.userId,
    role: "owner",
  });
  if (opts.billingEmail) {
    await h.db.insert(schema.billingDetails).values({
      organizationId,
      email: opts.billingEmail,
    });
  }
  return organizationId;
}

async function customerOf(organizationId: string) {
  const [row] = await h.db
    .select()
    .from(schema.billingCustomer)
    .where(eq(schema.billingCustomer.organizationId, organizationId));
  return row;
}

describe("the email each organization's Paystack customer gets", () => {
  it("tags the address with a short, lower-case id from the organization", () => {
    const tag = organizationTag("org_Kola1");
    expect(tag).toMatch(/^[0-9a-f]{8}$/);
    expect(taggedEmail("Ada@KolaLogistics.test", "org_Kola1")).toBe(
      `ada+${tag}@kolalogistics.test`
    );
    // Same input, same address: the tag does not depend on name or slug.
    expect(taggedEmail("ada@kolalogistics.test", "org_Kola1")).toBe(
      taggedEmail("ada@kolalogistics.test", "org_Kola1")
    );
    expect(taggedEmail("ada@kolalogistics.test", "org_Kola2")).not.toBe(
      taggedEmail("ada@kolalogistics.test", "org_Kola1")
    );
  });

  it("refuses to tag an address past the 64-character local part limit", () => {
    expect(taggedEmail(`${"a".repeat(56)}@kolalogistics.test`, "o")).toBeNull();
    expect(
      taggedEmail(`${"a".repeat(55)}@kolalogistics.test`, "o")
    ).not.toBeNull();
  });

  it("tries the billing email, then the person's own, then the tagged one", () => {
    const tagged = taggedEmail("ada@kolalogistics.test", "org_1");
    expect(
      customerEmailCandidates({
        organizationId: "org_1",
        billingEmail: null,
        actorEmail: "Ada@kolalogistics.test",
      })
    ).toEqual([
      { email: "ada@kolalogistics.test", source: "personal" },
      { email: tagged, source: "tagged" },
    ]);
    // With a billing email the organization wants its own address, so a
    // taken one falls back to the tagged address, not the personal one.
    expect(
      customerEmailCandidates({
        organizationId: "org_1",
        billingEmail: "Accounts@lagosbakery.test",
        actorEmail: "ada@kolalogistics.test",
      })
    ).toEqual([
      { email: "accounts@lagosbakery.test", source: "billing_email" },
      { email: tagged, source: "tagged" },
    ]);
  });
});

describe("one owner, two organizations, both on Starter", () => {
  it("gives each its own customer, both subscriptions start and both card checks are refunded", async () => {
    const ada = await person("ada");
    const kola = await orgFor(ada, "kola");
    const bakery = await orgFor(ada, "bakery");

    // The first goes through the webhook, the second through the callback.
    const first = await h.billing.startCheckout({
      organizationId: kola,
      actor: ada,
      planPriceId: STARTER,
    });
    expect(first.kind).toBe("trial");
    const firstPaid = h.pay(first.reference);
    expect((await h.deliver(firstPaid.charge))?.error).toBeNull();

    const second = await h.billing.startCheckout({
      organizationId: bakery,
      actor: ada,
      planPriceId: STARTER,
    });
    const secondPaid = h.pay(second.reference);
    const confirmed = await h.billing.confirmByReference(
      bakery,
      second.reference
    );
    expect(confirmed.paymentStatus).toBe("succeeded");
    expect((await h.deliver(secondPaid.charge))?.error).toBeNull();

    const [a, b] = [await customerOf(kola), await customerOf(bakery)];
    expect(a?.email).toBe(ada.email);
    expect(b?.email).toBe(taggedEmail(ada.email, bakery));
    expect(a?.paystackCustomerCode).not.toBe(b?.paystackCustomerCode);
    expect(firstPaid.customer.customer_code).toBe(a?.paystackCustomerCode);
    expect(secondPaid.customer.customer_code).toBe(b?.paystackCustomerCode);

    const subA = await h.billing.getSubscription(kola);
    const subB = await h.billing.getSubscription(bakery);
    expect(subA?.status).toBe("trialing");
    expect(subB?.status).toBe("trialing");
    for (const sub of [subA, subB]) {
      expect(
        h.fake.subscriptions.get(sub?.paystackSubscriptionCode ?? "")?.status
      ).toBe("active");
    }
    expect(subA?.paystackSubscriptionCode).not.toBe(
      subB?.paystackSubscriptionCode
    );
    const refunded = h.fake.refunds.map((r) => r.transaction);
    expect(refunded).toContain(first.reference);
    expect(refunded).toContain(second.reference);
  });
});

describe("choosing and locking the email", () => {
  it("doesn't adopt a Paystack customer someone else already has at the billing email", async () => {
    const victim = `someone.${n}@elsewhere.test`;
    // Paystack already knows this address, from outside this organization.
    h.fake.customers.set(victim, {
      customer_code: "CUS_someone_else",
      email: victim,
      id: 999_001,
    });
    const ada = await person("ada");
    const org = await orgFor(ada, "kola", { billingEmail: victim });
    await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    const stored = (await customerOf(org))?.email;
    expect(stored).not.toBe(victim);
    // With a billing email set, the fallback is the tagged address.
    expect(stored).toMatch(/^ada\.\d+\+[0-9a-f]{8}@kolalogistics\.test$/);
  });

  it("uses the billing email when it is set", async () => {
    const ada = await person("ada");
    const billingEmail = `accounts.${n}@lagosbakery.test`;
    const org = await orgFor(ada, "kola", { billingEmail });
    const preview = await h.billing.paystackEmail(org, ada.email);
    expect(preview).toEqual({
      locked: false,
      email: billingEmail,
      source: "billing_email",
    });
    const checkout = await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    expect((await customerOf(org))?.email).toBe(preview?.email);
    expect(
      h.fake.callsTo("POST", "/transaction/initialize").at(-1)?.body.email
    ).toBe(preview?.email);
    expect(checkout.reference).toBeTruthy();
    expect(await h.billing.paystackEmail(org, ada.email)).toEqual({
      locked: true,
      email: preview?.email,
    });
  });

  it("falls back to the tagged email when the billing email belongs to another organization's customer", async () => {
    const ada = await person("ada");
    const shared = `shared.${n}@lagosbakery.test`;
    const first = await orgFor(ada, "kola", { billingEmail: shared });
    const second = await orgFor(ada, "bakery", { billingEmail: shared });
    await h.billing.startCheckout({
      organizationId: first,
      actor: ada,
      planPriceId: STARTER,
    });
    expect((await customerOf(first))?.email).toBe(shared);

    const tagged = taggedEmail(ada.email, second);
    expect(await h.billing.paystackEmail(second, ada.email)).toEqual({
      locked: false,
      email: tagged,
      source: "tagged",
    });
    await h.billing.startCheckout({
      organizationId: second,
      actor: ada,
      planPriceId: STARTER,
    });
    const customer = await customerOf(second);
    expect(customer?.email).toBe(tagged);
    expect(customer?.paystackCustomerCode).not.toBe(
      (await customerOf(first))?.paystackCustomerCode
    );
  });

  it("keeps the tagged email across a slug rename", async () => {
    const ada = await person("ada");
    // The first organization takes the plain address.
    const kola = await orgFor(ada, "kola");
    const org = await orgFor(ada, "bakery");
    await h.billing.startCheckout({
      organizationId: kola,
      actor: ada,
      planPriceId: STARTER,
    });
    const before = await h.billing.paystackEmail(org, ada.email);
    await h.db
      .update(schema.organization)
      .set({ slug: `renamed-${n}`, name: "Renamed" })
      .where(eq(schema.organization.id, org));
    const after = await h.billing.paystackEmail(org, ada.email);
    expect(before).toMatchObject({ source: "tagged" });
    expect(after).toEqual(before);

    await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    expect((await customerOf(org))?.email).toBe(before?.email);
  });

  it("never changes a stored email, even when the billing email changes later", async () => {
    const ada = await person("ada");
    const org = await orgFor(ada, "kola");
    await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    const stored = (await customerOf(org))?.email;
    await h.billing.updateBillingDetails({
      organizationId: org,
      actor: ada,
      details: { email: `new.${n}@lagosbakery.test` },
    });
    await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    expect((await customerOf(org))?.email).toBe(stored);
    expect(await h.billing.paystackEmail(org, ada.email)).toEqual({
      locked: true,
      email: stored,
    });
  });

  it("adopts the existing Paystack customer when Paystack already knows the address", async () => {
    const ada = await person("ada");
    const org = await orgFor(ada, "kola");
    // Created earlier on Paystack, outside this app.
    await h.fake.handle(
      new Request("http://fake/customer", {
        method: "POST",
        body: JSON.stringify({ email: ada.email }),
      })
    );
    const known = h.fake.customers.get(ada.email);
    await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    expect((await customerOf(org))?.paystackCustomerCode).toBe(
      known?.customer_code
    );
  });

  it("adopts by email when Paystack refuses to create the customer", async () => {
    const ada = await person("ada");
    const org = await orgFor(ada, "kola");
    await h.fake.handle(
      new Request("http://fake/customer", {
        method: "POST",
        body: JSON.stringify({ email: ada.email }),
      })
    );
    const known = h.fake.customers.get(ada.email);
    h.fake.failNext("POST", /^\/customer$/, 400, "Customer already exists");
    await h.billing.startCheckout({
      organizationId: org,
      actor: ada,
      planPriceId: STARTER,
    });
    expect((await customerOf(org))?.paystackCustomerCode).toBe(
      known?.customer_code
    );
    expect(
      h.fake.callsTo("GET", `/customer/${encodeURIComponent(ada.email)}`)
    ).toHaveLength(1);
  });
});

describe("legacy data: two organizations sharing one Paystack customer", () => {
  /** Two organizations stored before customers were per organization. */
  async function legacyPair() {
    const ada = await person("ada");
    const kola = await orgFor(ada, "kola");
    const bakery = await orgFor(ada, "bakery");
    const customer = (await h.fake
      .handle(
        new Request("http://fake/customer", {
          method: "POST",
          body: JSON.stringify({ email: ada.email }),
        })
      )
      .then((r) => r.json())) as {
      data: { customer_code: string; email: string };
    };
    for (const organizationId of [kola, bakery]) {
      await h.db.insert(schema.billingCustomer).values({
        organizationId,
        paystackCustomerCode: customer.data.customer_code,
        email: ada.email,
        currency: "NGN",
      });
    }
    return { ada, kola, bakery, customer: customer.data };
  }

  /** A live Paystack subscription and our row for it. */
  async function liveSub(
    organizationId: string,
    customerCode: string,
    planPriceId: string
  ) {
    const code = `SUB_legacy_${organizationId}`;
    h.fake.subscriptions.set(code, {
      subscription_code: code,
      email_token: `tok_${organizationId}`,
      status: "active",
      plan: planCode(planPriceId),
      customer: customerCode,
      authorization: "AUTH_test0001",
      next_payment_date: "2026-04-01T10:00:00.000Z",
    });
    await h.db.insert(schema.subscription).values({
      id: `row_${organizationId}`,
      organizationId,
      planPriceId,
      status: "active",
      currency: "NGN",
      paystackSubscriptionCode: code,
      currentPeriodStart: START,
      currentPeriodEnd: new Date("2026-04-01T10:00:00.000Z"),
    });
    return code;
  }

  it("keeps their customer and still checks out", async () => {
    const { ada, kola, customer } = await legacyPair();
    await h.billing.startCheckout({
      organizationId: kola,
      actor: ada,
      planPriceId: STARTER,
    });
    expect(await customerOf(kola)).toMatchObject({
      paystackCustomerCode: customer.customer_code,
      email: ada.email,
    });
  });

  it("subscription.create finds the organization waiting for that plan", async () => {
    const { kola, bakery, customer } = await legacyPair();
    await liveSub(bakery, customer.customer_code, PRO);
    await h.db.insert(schema.subscription).values({
      id: `waiting_${kola}`,
      organizationId: kola,
      planPriceId: STARTER,
      status: "trialing",
      currency: "NGN",
    });
    const event = await h.deliver(
      subscriptionCreate({
        subscriptionCode: `SUB_new_${kola}`,
        emailToken: "tok_new",
        planCode: planCode(STARTER),
        amount: 500_000,
        customer,
        nextPaymentDate: "2026-03-15T10:00:00.000Z",
      })
    );
    expect(event?.error).toBeNull();
    expect(
      (await h.billing.getSubscription(kola))?.paystackSubscriptionCode
    ).toBe(`SUB_new_${kola}`);
    expect(
      (await h.billing.getSubscription(bakery))?.paystackSubscriptionCode
    ).toBe(`SUB_legacy_${bakery}`);
  });

  it("a renewal charge on a shared plan renews only the organization Paystack moved", async () => {
    const { kola, bakery, customer } = await legacyPair();
    await liveSub(kola, customer.customer_code, STARTER);
    const renewedCode = await liveSub(bakery, customer.customer_code, STARTER);
    const remote = h.fake.subscriptions.get(renewedCode);
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    h.clock.now = new Date("2026-04-01T11:00:00Z");
    const event = await h.deliver(
      chargeSuccess({
        reference: `renewal_${bakery}`,
        amount: 500_000,
        currency: "NGN",
        customer,
        planCode: planCode(STARTER),
        paidAt: h.clock.now.toISOString(),
      })
    );
    expect(event?.error).toBeNull();
    expect(
      (await h.billing.getSubscription(bakery))?.currentPeriodEnd?.toISOString()
    ).toBe("2026-05-01T10:00:00.000Z");
    expect(
      (await h.billing.getSubscription(kola))?.currentPeriodEnd?.toISOString()
    ).toBe("2026-04-01T10:00:00.000Z");
    const invoices = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.reference, `renewal_${bakery}`));
    expect(invoices.map((i) => i.organizationId)).toEqual([bakery]);
  });

  it("reconcile updates each organization from its own subscription", async () => {
    const { kola, bakery, customer } = await legacyPair();
    const kolaCode = await liveSub(kola, customer.customer_code, STARTER);
    const bakeryCode = await liveSub(bakery, customer.customer_code, PRO);
    const renewed = h.fake.subscriptions.get(kolaCode);
    const cancelled = h.fake.subscriptions.get(bakeryCode);
    if (renewed && cancelled) {
      renewed.next_payment_date = "2026-05-01T10:00:00.000Z";
      cancelled.status = "cancelled";
    }
    h.clock.now = new Date("2026-04-01T11:00:00Z");
    await h.billing.reconcile();
    const kolaSub = await h.billing.getSubscription(kola);
    expect(kolaSub?.status).toBe("active");
    expect(kolaSub?.currentPeriodEnd?.toISOString()).toBe(
      "2026-05-01T10:00:00.000Z"
    );
    expect(await h.billing.getSubscription(bakery)).toBeNull();
  });
});

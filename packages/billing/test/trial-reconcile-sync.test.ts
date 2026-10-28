import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listPlanPrices } from "../src/catalog";
import { createFakePaystack } from "../src/fake-paystack";
import {
  chargeSuccess,
  invoiceEvent,
  testAuthorization,
} from "../src/fixtures";
import { createPaystackClient } from "../src/paystack/client";
import { syncPlans } from "../src/sync";
import { type BillingHarness, planCode, setupBilling } from "./support";

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
const hours = (n: number) => new Date(START.getTime() + n * 3_600_000);
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
});

describe("card-up-front trial (PLAN §6.3 T1)", () => {
  it("charges a refundable tokenisation amount without a plan", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    expect(checkout).toMatchObject({ kind: "trial", amountSubunit: 5000 });
    const [init] = h.fake.callsTo("POST", "/transaction/initialize").slice(-1);
    expect(init?.body.amount).toBe(5000);
    expect(init?.body.plan).toBeUndefined();
    expect(init?.body.channels).toEqual(["card"]);
  });

  it("after the card is tokenised: refund, subscription starting at trial end, trialing", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    await h.deliver(paid.charge);

    const sub = await h.billing.getSubscription(org.organizationId);
    const trialEnd = new Date(START.getTime() + 14 * 86_400_000);
    expect(sub).toMatchObject({
      status: "trialing",
      planPriceId: "starter-monthly-ngn",
    });
    expect(sub?.trialEndsAt).toEqual(trialEnd);
    expect(h.fake.refunds.at(-1)).toEqual({
      transaction: checkout.reference,
      amount: undefined,
    });
    const [create] = h.fake.callsTo("POST", "/subscription").slice(-1);
    expect(create?.body).toMatchObject({
      plan: planCode("starter-monthly-ngn"),
      authorization: "AUTH_test0001",
      start_date: trialEnd.toISOString(),
    });
    expect((await h.billing.getEntitlement(org.organizationId)).reason).toBe(
      "trialing"
    );
    expect(h.notifications.at(-1)).toMatchObject({ type: "trial_started" });

    // The first real charge at trial end converts it.
    h.clock.now = trialEnd;
    const remote = h.fake.subscriptions.get(
      sub?.paystackSubscriptionCode ?? ""
    );
    if (remote) {
      remote.next_payment_date = "2026-04-15T10:00:00.000Z";
    }
    await h.deliver(
      chargeSuccess({
        reference: "trial_first_charge",
        amount: 1_000_000,
        currency: "NGN",
        customer: paid.customer,
        planCode: planCode("starter-monthly-ngn"),
      })
    );
    const after = await h.billing.getSubscription(org.organizationId);
    expect(after?.status).toBe("active");
    expect(after?.currentPeriodEnd?.toISOString()).toBe(
      "2026-04-15T10:00:00.000Z"
    );
  });

  it("refunds and does not start a trial on a non-reusable card", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    h.fake.pay(checkout.reference, testAuthorization({ reusable: false }));
    const tx = h.fake.transactions.get(checkout.reference);
    const event = await h.deliver(
      chargeSuccess({
        reference: checkout.reference,
        amount: 5000,
        currency: "NGN",
        customer: {
          customer_code: tx?.customer_code ?? "",
          email: tx?.email ?? "",
        },
        authorization: testAuthorization({ reusable: false }),
        metadata: tx?.metadata,
      })
    );
    expect(event?.error).toBe("card_not_reusable");
    expect(await h.billing.getSubscription(org.organizationId)).toBeNull();
    expect(h.fake.refunds.at(-1)?.transaction).toBe(checkout.reference);
  });

  it("skips trials entirely when trialMode is off", async () => {
    h.billing.deps.trialMode = "off";
    try {
      const org = await h.createOrg();
      const checkout = await h.billing.startCheckout({ ...org, planPriceId: "starter-monthly-ngn" });
      expect(checkout).toMatchObject({ kind: "subscribe", amountSubunit: 1_000_000 });
    } finally {
      h.billing.deps.trialMode = "card";
    }
  });

  it("does not offer a second trial", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    expect(checkout.kind).toBe("subscribe");
  });

  it("upgrades during a trial without charging", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    await h.deliver(h.pay(checkout.reference).charge);
    const before = h.fake.callsTo(
      "POST",
      "/transaction/charge_authorization"
    ).length;
    const result = await h.billing.changePlan({
      ...org,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(result).toEqual({ kind: "upgraded", charged: 0 });
    expect(
      h.fake.callsTo("POST", "/transaction/charge_authorization").length
    ).toBe(before);
    expect(await h.billing.getSubscription(org.organizationId)).toMatchObject({
      status: "trialing",
      planPriceId: "pro-monthly-ngn",
    });
  });

  it("stays trialing (and loses access) if the trial ends with no charge", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    await h.deliver(h.pay(checkout.reference).charge);
    h.clock.now = new Date(START.getTime() + 16 * 86_400_000);
    await h.billing.reconcile();
    const sub = await h.billing.getSubscription(org.organizationId);
    expect(sub?.status).toBe("trialing");
    expect((await h.billing.getEntitlement(org.organizationId)).active).toBe(
      false
    );
  });
});

describe("reconcile (PLAN §6.9)", () => {
  it("abandons unpaid checkouts older than an hour", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    h.clock.now = hours(2);
    const report = await h.billing.reconcile();
    expect(report.intentsAbandoned).toBeGreaterThanOrEqual(1);
    const [intent] = await h.db
      .select()
      .from(schema.paymentIntent)
      .where(eq(schema.paymentIntent.id, checkout.reference));
    expect(intent?.status).toBe("abandoned");
  });

  it("activates a paid checkout whose webhook never arrived", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    h.pay(checkout.reference);
    h.clock.now = hours(2);
    const report = await h.billing.reconcile();
    expect(report.intentsConfirmed).toBeGreaterThanOrEqual(1);
    expect((await h.billing.getSubscription(org.organizationId))?.status).toBe(
      "active"
    );
  });

  it("picks up a renewal whose webhook was missed", async () => {
    const { organizationId, sub } = await h.subscribe();
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    h.clock.now = new Date((sub.currentPeriodEnd?.getTime() ?? 0) + 3_600_000);
    await h.billing.reconcile();
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.currentPeriodEnd?.toISOString()).toBe(
      "2026-05-01T10:00:00.000Z"
    );
    expect((await h.billing.getEntitlement(organizationId)).active).toBe(true);
  });

  it("ends a non-renewing subscription after its period", async () => {
    const { organizationId, actor, sub } = await h.subscribe();
    await h.billing.cancel({ organizationId, actor });
    h.clock.now = new Date((sub.currentPeriodEnd?.getTime() ?? 0) + 1000);
    await h.billing.reconcile();
    expect(await h.billing.getSubscription(organizationId)).toBeNull();
  });

  it("cancels past_due subscriptions after grace and disables them on Paystack", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    await h.deliver(
      invoiceEvent({
        event: "invoice.payment_failed",
        invoiceCode: `INV_${organizationId}`,
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        amount: 3_000_000,
        status: "failed",
        paid: false,
        customer: paid.customer,
        periodStart: sub.currentPeriodStart?.toISOString() ?? "",
        periodEnd: sub.currentPeriodEnd?.toISOString() ?? "",
      })
    );
    h.clock.now = new Date(START.getTime() + 8 * 86_400_000);
    const report = await h.billing.reconcile();
    expect(report.subscriptionsExpired).toBeGreaterThanOrEqual(1);
    expect(await h.billing.getSubscription(organizationId)).toBeNull();
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("non-renewing");
  });

  it("retries disabling a replaced subscription", async () => {
    const { organizationId, actor, sub } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.fake.failNext("POST", /^\/subscription\/disable$/, 500);
    for (let i = 0; i < 3; i++) {
      h.fake.failNext("POST", /^\/subscription\/disable$/, 500);
    }
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("active");
    const report = await h.billing.reconcile();
    expect(report.replacedDisabled).toBeGreaterThanOrEqual(1);
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("non-renewing");
  });

  it("is safe to run twice", async () => {
    await h.billing.reconcile();
    const second = await h.billing.reconcile();
    expect(second.errors).toEqual([]);
  });
});

describe("syncPlans (PLAN §6.1)", () => {
  it("creates plans once, adopts existing ones, and refuses in-place price changes", async () => {
    const { db, close } = await createTestDb();
    const fake = createFakePaystack();
    const paystack = createPaystackClient({
      secretKey: "sk_test_sync",
      baseUrl: "http://fake",
      fetch: (input, init) => fake.handle(new Request(input, init)),
    });
    const ngn = listPlanPrices().filter((p) => p.currency === "NGN");

    const first = await syncPlans({ db, paystack, currencies: ["NGN"] });
    expect(first.created.sort()).toEqual(ngn.map((p) => p.id).sort());
    const second = await syncPlans({ db, paystack, currencies: ["NGN"] });
    expect(second.created).toEqual([]);
    expect(second.unchanged).toHaveLength(ngn.length);

    // A fresh database adopts the plans already on the Paystack account.
    const fresh = await createTestDb();
    const adopted = await syncPlans({
      db: fresh.db,
      paystack,
      currencies: ["NGN"],
    });
    expect(adopted.created).toEqual([]);
    expect(adopted.adopted).toHaveLength(ngn.length);
    expect(fake.plans.size).toBe(ngn.length);

    const changed = ngn.map((p) =>
      p.id === "pro-monthly-ngn" ? { ...p, amountSubunit: 3_500_000 } : p
    );
    await expect(syncPlans({ db, paystack, prices: changed })).rejects.toThrow(
      /not changed in place/
    );
    await fresh.close();
    await close();
  });
});

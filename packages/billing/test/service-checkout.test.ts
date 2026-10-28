import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { invoiceEvent, subscriptionStatusEvent } from "../src/fixtures";
import { type BillingHarness, KEY, planCode, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = new Date("2026-03-01T10:00:00Z");
});

const invoicesOf = (orgId: string) =>
  h.db
    .select()
    .from(schema.invoice)
    .where(eq(schema.invoice.organizationId, orgId));

describe("startCheckout (PLAN §2.3 #6)", () => {
  it("initializes with the server's amount, plan code and metadata", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const [call] = h.fake.callsTo("POST", "/transaction/initialize").slice(-1);
    expect(call?.body).toMatchObject({
      amount: 3_000_000,
      currency: "NGN",
      plan: planCode("pro-monthly-ngn"),
      channels: ["card"],
      reference: checkout.reference,
      metadata: {
        organization_id: org.organizationId,
        payment_intent_id: checkout.reference,
        kind: "subscribe",
      },
    });
    expect(checkout.kind).toBe("subscribe");
    expect(checkout.accessCode).toMatch(/^acc_/);
    // Nothing is granted by starting a checkout.
    expect(await h.billing.getSubscription(org.organizationId)).toBeNull();
    expect((await h.billing.getEntitlement(org.organizationId)).active).toBe(
      false
    );
  });

  it("refuses unknown plans and a second subscription", async () => {
    const { organizationId, actor } = await h.subscribe();
    await expect(
      h.billing.startCheckout({
        organizationId,
        actor,
        planPriceId: "pro-monthly-ngn",
      })
    ).rejects.toMatchObject({ code: "already_subscribed" });
    await expect(
      h.billing.startCheckout({
        organizationId,
        actor,
        planPriceId: "gold-forever",
      })
    ).rejects.toMatchObject({ code: "plan_not_found" });
  });
});

describe("activation from webhooks", () => {
  it("charge.success then subscription.create → active", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    expect(sub).toMatchObject({
      status: "active",
      planPriceId: "pro-monthly-ngn",
      paystackSubscriptionCode: paid.subscription?.subscription_code,
      cardLast4: "4081",
    });
    // Secrets are encrypted at rest.
    expect(sub.paystackEmailToken).not.toBe(paid.subscription?.email_token);
    expect(sub.authorizationCode).toMatch(/^v1:/);
    expect(sub.authorizationCode).not.toContain("AUTH_");
    expect(await invoicesOf(organizationId)).toHaveLength(1);
    expect(await h.billing.getEntitlement(organizationId)).toMatchObject({
      active: true,
      plan: { key: "pro" },
    });
    expect(KEY).toHaveLength(64);
  });

  it("subscription.create before charge.success → same final state", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    await h.deliver(paid.created);
    await h.deliver(paid.charge);
    const sub = await h.billing.getSubscription(org.organizationId);
    expect(sub).toMatchObject({
      status: "active",
      planPriceId: "pro-monthly-ngn",
      paystackSubscriptionCode: paid.subscription?.subscription_code,
      cardLast4: "4081",
    });
    expect(sub?.authorizationCode).toMatch(/^v1:/);
    expect(sub?.currentPeriodEnd).not.toBeNull();
    expect(await invoicesOf(org.organizationId)).toHaveLength(1);
  });

  it("is idempotent across duplicate and re-sent charge.success (PLAN §2.3 #9)", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    await h.deliver(paid.charge);
    // Identical body: deduped at ingest.
    await h.deliver(paid.charge);
    // Same charge, different body (Paystack retry with a new envelope).
    await h.deliver({
      ...paid.charge,
      data: { ...paid.charge.data, fees: 101 },
    });
    await h.deliver(paid.created);
    const subs = await h.db
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.organizationId, org.organizationId));
    expect(subs.filter((s) => s.status === "active")).toHaveLength(1);
    expect(await invoicesOf(org.organizationId)).toHaveLength(1);
  });

  it("does not activate when the amount doesn't match the intent", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    const tampered = {
      ...paid.charge,
      data: { ...paid.charge.data, amount: 100 },
    };
    const event = await h.deliver(tampered);
    expect(event?.error).toBe("charge_mismatch");
    expect(await h.billing.getSubscription(org.organizationId)).toBeNull();
    const [intent] = await h.db
      .select()
      .from(schema.paymentIntent)
      .where(eq(schema.paymentIntent.id, checkout.reference));
    expect(intent?.status).toBe("failed");
  });

  it("does not activate when metadata points at another organization", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    const event = await h.deliver({
      ...paid.charge,
      data: {
        ...paid.charge.data,
        metadata: {
          organization_id: "org_attacker",
          payment_intent_id: checkout.reference,
        },
      },
    });
    expect(event?.error).toBe("charge_mismatch");
    expect(await h.billing.getSubscription(org.organizationId)).toBeNull();
  });

  it("does not activate a different currency", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    const event = await h.deliver({
      ...paid.charge,
      data: { ...paid.charge.data, currency: "USD" },
    });
    expect(event?.error).toBe("charge_mismatch");
  });
});

describe("server-side verify", () => {
  it("confirmByReference activates without any webhook; the webhook is then a no-op", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(result.paymentStatus).toBe("succeeded");
    expect(result.subscription?.status).toBe("active");
    await h.deliver(paid.charge);
    expect(await invoicesOf(org.organizationId)).toHaveLength(1);
  });

  it("refuses a reference that belongs to another organization", async () => {
    const a = await h.createOrg({ previouslySubscribed: true });
    const b = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...a,
      planPriceId: "starter-monthly-ngn",
    });
    await expect(
      h.billing.confirmByReference(b.organizationId, checkout.reference)
    ).rejects.toThrow();
  });

  it("leaves an unpaid checkout alone", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(result.paymentStatus).toBe("created");
    expect(result.subscription).toBeNull();
  });
});

describe("renewal lifecycle", () => {
  it("invoice.create alone records a pending invoice and grants nothing new (PLAN §2.3 #8)", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    await h.deliver(
      invoiceEvent({
        event: "invoice.create",
        invoiceCode: "INV_upcoming",
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        amount: 3_000_000,
        status: "pending",
        paid: false,
        customer: paid.customer,
        periodStart: sub.currentPeriodEnd?.toISOString() ?? "",
        periodEnd: "2026-05-01T00:00:00.000Z",
      })
    );
    const [inv] = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.paystackInvoiceCode, "INV_upcoming"));
    expect(inv?.status).toBe("pending");
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.status).toBe("active");
    expect(after?.currentPeriodEnd).toEqual(sub.currentPeriodEnd);
  });

  it("a renewal charge.success moves the period forward", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    const code = sub.paystackSubscriptionCode ?? "";
    // Paystack charges on the due date and moves next_payment_date.
    h.clock.now = new Date(sub.currentPeriodEnd ?? 0);
    const remote = h.fake.subscriptions.get(code);
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    await h.deliver({
      ...paid.charge,
      data: {
        ...paid.charge.data,
        reference: "renewal_ref_1",
        metadata: "",
        paid_at: h.clock.now.toISOString(),
      },
    });
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.status).toBe("active");
    expect(after?.currentPeriodEnd?.toISOString()).toBe(
      "2026-05-01T10:00:00.000Z"
    );
    expect(await invoicesOf(organizationId)).toHaveLength(2);
    h.clock.now = new Date("2026-03-01T10:00:00Z");
  });

  it("invoice.payment_failed → past_due with a grace period, then no access", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    await h.deliver(
      invoiceEvent({
        event: "invoice.payment_failed",
        invoiceCode: `INV_fail_${organizationId}`,
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        amount: 3_000_000,
        status: "failed",
        paid: false,
        customer: paid.customer,
        periodStart: sub.currentPeriodStart?.toISOString() ?? "",
        periodEnd: sub.currentPeriodEnd?.toISOString() ?? "",
      })
    );
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.status).toBe("past_due");
    expect(after?.graceUntil?.toISOString()).toBe("2026-03-08T10:00:00.000Z");
    expect(h.notifications.at(-1)).toMatchObject({
      type: "past_due",
      organizationId,
      manageLink: expect.stringContaining("/manage/"),
    });
    expect((await h.billing.getEntitlement(organizationId)).reason).toBe(
      "past_due_grace"
    );
    h.clock.now = new Date("2026-03-09T00:00:00Z");
    expect((await h.billing.getEntitlement(organizationId)).active).toBe(false);
    h.clock.now = new Date("2026-03-01T10:00:00Z");
  });

  it.each([
    ["not_renew first", ["subscription.not_renew", "subscription.disable"]],
    ["disable first", ["subscription.disable", "subscription.not_renew"]],
  ] as const)(
    "cancellation (%s): non_renewing until period end, then canceled",
    async (_, order) => {
      const { organizationId, sub, paid } = await h.subscribe();
      const event = (name: (typeof order)[number]) =>
        subscriptionStatusEvent({
          event: name,
          subscriptionCode: sub.paystackSubscriptionCode ?? "",
          status: name === "subscription.disable" ? "complete" : "non-renewing",
          planCode: planCode("pro-monthly-ngn"),
          customer: paid.customer,
        });
      for (const name of order) {
        await h.deliver(event(name));
      }
      let after = await h.billing.getSubscription(organizationId);
      expect(after).toMatchObject({
        status: "non_renewing",
        cancelAtPeriodEnd: true,
      });
      expect((await h.billing.getEntitlement(organizationId)).active).toBe(
        true
      );

      h.clock.now = new Date((sub.currentPeriodEnd?.getTime() ?? 0) + 1000);
      await h.deliver({
        ...event("subscription.disable"),
        data: { ...event("subscription.disable").data, created_at: "later" },
      });
      after = await h.billing.getSubscription(organizationId);
      expect(after).toBeNull();
      const [ended] = await h.db
        .select()
        .from(schema.subscription)
        .where(
          eq(
            schema.subscription.paystackSubscriptionCode,
            sub.paystackSubscriptionCode ?? ""
          )
        );
      expect(ended?.status).toBe("canceled");
      h.clock.now = new Date("2026-03-01T10:00:00Z");
    }
  );
});

describe("failure handling (PLAN §2.3 #13)", () => {
  it("a handler error is recorded, not thrown, and the event is retried later", async () => {
    const { sub, paid } = await h.subscribe();
    // Renewal path needs GET /subscription; make Paystack fail 4 times.
    for (let i = 0; i < 4; i++) {
      h.fake.failNext("GET", /^\/subscription\//, 500);
    }
    const event = await h.deliver({
      ...paid.charge,
      data: {
        ...paid.charge.data,
        reference: "renewal_will_fail",
        metadata: "",
      },
    });
    expect(event?.processedAt).toBeNull();
    expect(event?.error).toBeTruthy();
    expect(event?.attempts).toBe(1);
    const retried = await h.billing.processPending();
    expect(retried.processed).toBeGreaterThanOrEqual(1);
    const [again] = await h.db
      .select()
      .from(schema.webhookEvent)
      .where(eq(schema.webhookEvent.id, event?.id ?? ""));
    expect(again?.processedAt).not.toBeNull();
    expect(sub.status).toBe("active");
  });
});

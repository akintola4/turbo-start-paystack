import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { type BillingHarness, planCode, setupBilling } from "./support";

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
const TRIAL_END = new Date(START.getTime() + 14 * 86_400_000);
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
});

// A downgrade during a trial must retire the trial's Paystack subscription,
// or both would charge when the trial ends.
describe("downgrade during a trial", () => {
  it("leaves exactly one live Paystack subscription, starting at trial end", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-annually-ngn",
    });
    await h.deliver(h.pay(checkout.reference).charge);
    const trial = await h.billing.getSubscription(org.organizationId);
    expect(trial).toMatchObject({ status: "trialing" });
    const oldCode = trial?.paystackSubscriptionCode ?? "";

    h.clock.now = new Date(START.getTime() + 3_600_000);
    const result = await h.billing.changePlan({
      ...org,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(result).toEqual({
      kind: "downgrade_scheduled",
      effectiveAt: TRIAL_END,
    });

    const live = [...h.fake.subscriptions.values()].filter(
      (s) =>
        s.status === "active" &&
        s.customer === h.fake.subscriptions.get(oldCode)?.customer
    );
    expect(h.fake.subscriptions.get(oldCode)?.status).not.toBe("active");
    expect(live.map((s) => s.plan)).toEqual([planCode("pro-monthly-ngn")]);
    expect(live[0]?.next_payment_date).toBe(TRIAL_END.toISOString());
  });

  it("keeps every replacement on the trial end after an upgrade, then a downgrade", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    await h.deliver(h.pay(checkout.reference).charge);
    const customer = h.fake.subscriptions.get(
      (await h.billing.getSubscription(org.organizationId))
        ?.paystackSubscriptionCode ?? ""
    )?.customer;

    h.clock.now = new Date(START.getTime() + 19 * 60_000);
    expect(
      await h.billing.changePlan({
        ...org,
        planPriceId: "pro-annually-ngn",
        memberCount: 1,
      })
    ).toMatchObject({ kind: "upgraded", charged: 0 });

    h.clock.now = new Date(START.getTime() + 85 * 60_000);
    await h.billing.changePlan({
      ...org,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });

    const sub = await h.billing.getSubscription(org.organizationId);
    expect(sub?.trialEndsAt).toEqual(TRIAL_END);
    const live = [...h.fake.subscriptions.values()].filter(
      (s) => s.status === "active" && s.customer === customer
    );
    expect(live.map((s) => [s.plan, s.next_payment_date])).toEqual([
      [planCode("pro-monthly-ngn"), TRIAL_END.toISOString()],
    ]);
  });
});

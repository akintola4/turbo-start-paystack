import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type BillingHarness, setupBilling } from "./support";

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
beforeAll(async () => {
  h = await setupBilling();
  h.clock.now = START;
});
afterAll(async () => h.close());

// Trial eligibility is decided when a checkout starts, so a second trial
// checkout opened at the same time must not start a second trial later.
describe("one free trial per organization", () => {
  it("refunds and refuses a stale trial checkout paid after the first trial ended", async () => {
    const org = await h.createOrg();
    const first = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const second = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    expect(first.kind).toBe("trial");
    expect(second.kind).toBe("trial");

    await h.deliver(h.pay(first.reference).charge);
    const trial = await h.billing.getSubscription(org.organizationId);
    expect(trial?.status).toBe("trialing");
    await h.billing.cancel(org);
    h.clock.now = new Date((trial?.currentPeriodEnd?.getTime() ?? 0) + 1000);
    await h.billing.reconcile();
    expect(await h.billing.getSubscription(org.organizationId)).toBeNull();

    await h.deliver(h.pay(second.reference).charge);
    expect(await h.billing.getSubscription(org.organizationId)).toBeNull();
    expect(h.fake.refunds.some((r) => r.transaction === second.reference)).toBe(
      true
    );
  });
});

import { schema } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { chargeSuccess, subscriptionStatusEvent } from "../src/fixtures";
import { getPlanPrice, planChangeKind } from "../src/catalog";
import { computeProration, upgradeChargeNow } from "../src/proration";
import { staleUpgradeReason } from "../src/service/charge";
import { type BillingHarness, planCode, setupBilling } from "./support";

let h: BillingHarness;
const fail = (): never => {
  throw new Error("unknown plan price");
};
const START = new Date("2026-03-01T10:00:00Z");
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
  h.fake.setChargeOutcome("success");
});

/** Index of the first call to METHOD PATH after `from`. */
function callIndex(method: string, path: string | RegExp, from = 0) {
  return h.fake.calls.findIndex(
    (c, i) =>
      i >= from &&
      c.method === method &&
      (typeof path === "string" ? c.path === path : path.test(c.path))
  );
}

const midPeriod = (sub: {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}) =>
  new Date(
    ((sub.currentPeriodStart?.getTime() ?? 0) +
      (sub.currentPeriodEnd?.getTime() ?? 0)) /
      2
  );

describe("upgrade (prorated, PLAN §2.3 #10)", () => {
  it("charges the difference, creates the new subscription, then disables the old", async () => {
    const { organizationId, actor, sub } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.clock.now = midPeriod(sub);
    const before = h.fake.calls.length;

    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 2,
    });

    const expected = computeProration({
      oldAmount: 1_000_000,
      oldInterval: "monthly",
      newAmount: 3_000_000,
      newInterval: "monthly",
      periodStart: sub.currentPeriodStart ?? START,
      periodEnd: sub.currentPeriodEnd ?? START,
      now: h.clock.now,
    }).charge;
    expect(result).toEqual({ kind: "upgraded", charged: expected });
    expect(expected).toBe(1_000_000);

    const charge = callIndex(
      "POST",
      "/transaction/charge_authorization",
      before
    );
    const create = callIndex("POST", "/subscription", before);
    const disable = callIndex("POST", "/subscription/disable", before);
    expect(charge).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(charge);
    expect(disable).toBeGreaterThan(create);
    expect(h.fake.calls[charge]?.body).toMatchObject({
      amount: expected,
      currency: "NGN",
    });
    expect(h.fake.calls[create]?.body).toMatchObject({
      plan: planCode("pro-monthly-ngn"),
      start_date: sub.currentPeriodEnd?.toISOString(),
    });
    expect(h.fake.calls[disable]?.body).toMatchObject({
      code: sub.paystackSubscriptionCode,
    });

    const after = await h.billing.getSubscription(organizationId);
    expect(after?.planPriceId).toBe("pro-monthly-ngn");
    expect(after?.paystackSubscriptionCode).not.toBe(
      sub.paystackSubscriptionCode
    );
    expect(after?.currentPeriodEnd).toEqual(sub.currentPeriodEnd);
    expect((await h.billing.getEntitlement(organizationId)).plan.key).toBe(
      "pro"
    );
    // Our own disable call succeeded (not left for reconcile).
    const [replaced] = await h.db
      .select()
      .from(schema.replacedSubscription)
      .where(
        eq(
          schema.replacedSubscription.paystackSubscriptionCode,
          sub.paystackSubscriptionCode ?? ""
        )
      );
    expect(replaced?.disabledAt).not.toBeNull();
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("non-renewing");
  });

  it("ignores later not_renew/disable webhooks for the replaced subscription", async () => {
    const { organizationId, actor, sub, paid } = await h.subscribe(
      "starter-monthly-ngn"
    );
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    for (const event of [
      "subscription.not_renew",
      "subscription.disable",
    ] as const) {
      await h.deliver(
        subscriptionStatusEvent({
          event,
          subscriptionCode: sub.paystackSubscriptionCode ?? "",
          status:
            event === "subscription.disable" ? "complete" : "non-renewing",
          planCode: planCode("starter-monthly-ngn"),
          customer: paid.customer,
        })
      );
    }
    const after = await h.billing.getSubscription(organizationId);
    expect(after).toMatchObject({
      status: "active",
      planPriceId: "pro-monthly-ngn",
    });
    const [replaced] = await h.db
      .select()
      .from(schema.replacedSubscription)
      .where(
        eq(
          schema.replacedSubscription.paystackSubscriptionCode,
          sub.paystackSubscriptionCode ?? ""
        )
      );
    expect(replaced?.disabledAt).not.toBeNull();
  });

  it("refunds and keeps the old plan if the new subscription can't be created", async () => {
    const { organizationId, actor, sub } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.clock.now = midPeriod(sub);
    h.fake.failNext("POST", /^\/subscription$/, 400, "Plan not found");
    const refundsBefore = h.fake.refunds.length;
    await expect(
      h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: "pro-monthly-ngn",
        memberCount: 1,
      })
    ).rejects.toMatchObject({ code: "upgrade_failed" });

    expect(h.fake.refunds.length).toBe(refundsBefore + 1);
    const after = await h.billing.getSubscription(organizationId);
    expect(after).toMatchObject({
      planPriceId: "starter-monthly-ngn",
      paystackSubscriptionCode: sub.paystackSubscriptionCode,
      status: "active",
    });
    // The old subscription was never disabled.
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("active");
    // The failure is on record even though the call threw.
    const audits = await h.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.organizationId, organizationId),
          eq(schema.auditLog.action, "billing.plan_change_failed")
        )
      );
    expect(audits).toHaveLength(1);
    const intents = await h.db
      .select()
      .from(schema.paymentIntent)
      .where(
        and(
          eq(schema.paymentIntent.organizationId, organizationId),
          eq(schema.paymentIntent.kind, "proration")
        )
      );
    expect(intents[0]?.status).toBe("failed");
  });

  it("falls back to checkout when the saved card is declined, and completes from the webhook", async () => {
    const { organizationId, actor, sub } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.clock.now = midPeriod(sub);
    h.fake.setChargeOutcome("failed");
    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(result.kind).toBe("checkout_required");
    if (result.kind !== "checkout_required") {
      return;
    }
    expect(result.amountSubunit).toBe(1_000_000);
    expect((await h.billing.getSubscription(organizationId))?.planPriceId).toBe(
      "starter-monthly-ngn"
    );

    const paid = h.pay(result.reference);
    await h.deliver(paid.charge);
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.planPriceId).toBe("pro-monthly-ngn");
    expect(after?.paystackSubscriptionCode).not.toBe(
      sub.paystackSubscriptionCode
    );
  });

  it("sends the customer to authorize when the bank pauses the charge (2FA)", async () => {
    const { organizationId, actor, sub, paid } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.clock.now = midPeriod(sub);
    h.fake.setChargeOutcome("paused");
    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(result.kind).toBe("checkout_required");
    if (result.kind !== "checkout_required") {
      return;
    }
    expect(result.authorizationUrl).toContain("checkout.paystack.test");
    await h.deliver(
      chargeSuccess({
        reference: result.reference,
        amount: result.amountSubunit,
        currency: "NGN",
        customer: paid.customer,
        metadata: { organization_id: organizationId },
        paidAt: h.clock.now.toISOString(),
      })
    );
    expect((await h.billing.getSubscription(organizationId))?.planPriceId).toBe(
      "pro-monthly-ngn"
    );
  });

  it("refunds a one-day-left proration checkout paid after the renewal and grants nothing (audit #2)", async () => {
    const { organizationId, actor, sub, paid } = await h.subscribe(
      "starter-monthly-ngn"
    );
    const end = sub.currentPeriodEnd ?? START;
    // One day left in the period; the saved card is declined, so a checkout
    // for the prorated difference is opened and left unpaid.
    h.clock.now = new Date(end.getTime() - 86_400_000);
    h.fake.setChargeOutcome("failed");
    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    h.fake.setChargeOutcome("success");
    if (result.kind !== "checkout_required") {
      throw new Error(`expected a checkout, got ${result.kind}`);
    }
    const [intent] = await h.db
      .select()
      .from(schema.paymentIntent)
      .where(eq(schema.paymentIntent.id, result.reference));
    expect(intent?.periodStart).toEqual(sub.currentPeriodStart);
    expect(intent?.expiresAt).toEqual(end);

    // The period renews on the old plan.
    h.clock.now = new Date(end.getTime() + 60_000);
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    await h.deliver(
      chargeSuccess({
        reference: `renew_stale_${organizationId}`,
        amount: 1_000_000,
        currency: "NGN",
        customer: paid.customer,
        planCode: planCode("starter-monthly-ngn"),
        paidAt: h.clock.now.toISOString(),
      })
    );
    const renewed = await h.billing.getSubscription(organizationId);
    expect(renewed?.currentPeriodStart?.getTime()).toBeGreaterThan(
      end.getTime() - 1
    );

    // Then the stale checkout is paid.
    const refundsBefore = h.fake.refunds.length;
    const late = h.pay(result.reference);
    const event = await h.deliver(late.charge);
    expect(event?.error).toBe("stale_upgrade:expired");

    const after = await h.billing.getSubscription(organizationId);
    expect(after?.planPriceId).toBe("starter-monthly-ngn");
    expect(after?.paystackSubscriptionCode).toBe(sub.paystackSubscriptionCode);
    expect((await h.billing.getEntitlement(organizationId)).plan.key).toBe(
      "starter"
    );
    expect(h.fake.refunds.length).toBe(refundsBefore + 1);
    const [invoice] = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.reference, result.reference));
    expect(invoice).toMatchObject({ status: "void" });
    expect(invoice?.refundedAt).not.toBeNull();
    expect(invoice?.number).toBeNull();

    // A second delivery of the charge refunds nothing more.
    await h.deliver({ ...late.charge, redelivered: true });
    expect(h.fake.refunds.length).toBe(refundsBefore + 1);
    expect(
      (await h.billing.confirmByReference(organizationId, result.reference))
        .paymentStatus
    ).toBe("failed");
  });

  it("treats an intent from an earlier period as stale even before it expires", () => {
    const periodStart = new Date("2026-04-01T10:00:00Z");
    const paidAt = new Date("2026-04-01T11:00:00Z");
    const intent = {
      createdAt: new Date("2026-03-31T20:00:00Z"),
      periodStart: new Date("2026-03-01T10:00:00Z"),
      expiresAt: new Date("2026-04-01T20:00:00Z"),
    };
    expect(
      staleUpgradeReason(intent, { currentPeriodStart: periodStart }, paidAt)
    ).toBe("period_changed");
    // Rows from before the column existed fall back to createdAt.
    expect(
      staleUpgradeReason(
        { ...intent, periodStart: null, expiresAt: null },
        { currentPeriodStart: periodStart },
        paidAt
      )
    ).toBe("period_changed");
    expect(
      staleUpgradeReason(
        { ...intent, periodStart },
        { currentPeriodStart: periodStart },
        paidAt
      )
    ).toBeNull();
    expect(staleUpgradeReason(intent, null, paidAt)).toBe("no_subscription");
  });

  it("refuses currency changes and same-plan changes", async () => {
    const { organizationId, actor } = await h.subscribe("starter-monthly-ngn");
    await expect(
      h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: "pro-monthly-usd",
        memberCount: 1,
      })
    ).rejects.toMatchObject({ code: "currency_locked" });
    await expect(
      h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: "starter-monthly-ngn",
        memberCount: 1,
      })
    ).rejects.toMatchObject({ code: "same_plan" });
  });
});

describe("monthly to yearly on the same plan (planChangeKind)", () => {
  it("classifies changes the way changePlan applies them", () => {
    const pro = { rank: 2 };
    const starter = { rank: 1 };
    const m = "monthly" as const;
    const y = "annually" as const;
    expect(
      planChangeKind({ ...pro, interval: m }, { ...pro, interval: y })
    ).toBe("upgrade");
    expect(
      planChangeKind({ ...pro, interval: y }, { ...pro, interval: m })
    ).toBe("downgrade");
    expect(
      planChangeKind({ ...starter, interval: y }, { ...pro, interval: m })
    ).toBe("upgrade");
    expect(
      planChangeKind({ ...pro, interval: m }, { ...starter, interval: y })
    ).toBe("downgrade");
  });

  it("switches now outside a trial, charging exactly what upgradeChargeNow quotes", async () => {
    for (const [from, to] of [
      ["pro-monthly-ngn", "pro-annually-ngn"],
      ["starter-monthly-ngn", "pro-annually-ngn"],
    ] as const) {
      const { organizationId, actor, sub } = await h.subscribe(from);
      h.clock.now = midPeriod(sub);
      const quoted = upgradeChargeNow({
        sub,
        current: getPlanPrice(from) ?? fail(),
        target: getPlanPrice(to) ?? fail(),
        now: h.clock.now,
      });
      const result = await h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: to,
        memberCount: 1,
      });
      expect(result).toEqual({ kind: "upgraded", charged: quoted });
      // Not scheduled: the plan changes today.
      expect(await h.billing.getSubscription(organizationId)).toMatchObject({
        planPriceId: to,
        scheduledPlanPriceId: null,
      });
    }
    // Pro yearly costs less per day than Pro monthly: nothing to top up.
    // Starter monthly to Pro yearly does owe a difference.
    const pro = getPlanPrice("pro-monthly-ngn") ?? fail();
    const sub = {
      status: "active",
      currency: "NGN",
      currentPeriodStart: START,
      currentPeriodEnd: new Date("2026-04-01T10:00:00Z"),
    };
    const now = new Date("2026-03-16T10:00:00Z");
    expect(
      upgradeChargeNow({
        sub,
        current: pro,
        target: getPlanPrice("pro-annually-ngn") ?? fail(),
        now,
      })
    ).toBe(0);
    expect(
      upgradeChargeNow({
        sub,
        current: getPlanPrice("starter-monthly-ngn") ?? fail(),
        target: getPlanPrice("pro-annually-ngn") ?? fail(),
        now,
      })
    ).toBeGreaterThan(0);
    expect(
      upgradeChargeNow({
        sub: { ...sub, status: "trialing" },
        current: getPlanPrice("starter-monthly-ngn") ?? fail(),
        target: pro,
        now,
      })
    ).toBe(0);
  });

  it("switches now and charges nothing during a trial", async () => {
    const { organizationId, actor, sub } = await h.subscribe("pro-monthly-ngn");
    await h.db
      .update(schema.subscription)
      .set({ status: "trialing", trialEndsAt: sub.currentPeriodEnd })
      .where(eq(schema.subscription.id, sub.id));
    h.clock.now = midPeriod(sub);
    const before = h.fake.calls.length;
    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-annually-ngn",
      memberCount: 1,
    });
    expect(result).toEqual({ kind: "upgraded", charged: 0 });
    expect(callIndex("POST", "/transaction/charge_authorization", before)).toBe(
      -1
    );
    expect((await h.billing.getSubscription(organizationId))?.planPriceId).toBe(
      "pro-annually-ngn"
    );
  });
});

describe("downgrade (end of period)", () => {
  it("refuses when the org has more members than the smaller plan allows", async () => {
    const { organizationId, actor } = await h.subscribe("pro-monthly-ngn");
    await expect(
      h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: "starter-monthly-ngn",
        memberCount: 11,
      })
    ).rejects.toMatchObject({ code: "over_member_limit" });
  });

  it("creates the replacement first, keeps the current plan until period end, then swaps", async () => {
    const { organizationId, actor, sub, paid } =
      await h.subscribe("pro-monthly-ngn");
    const before = h.fake.calls.length;
    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 3,
    });
    expect(result).toEqual({
      kind: "downgrade_scheduled",
      effectiveAt: sub.currentPeriodEnd,
    });
    const create = callIndex("POST", "/subscription", before);
    const disable = callIndex("POST", "/subscription/disable", before);
    expect(create).toBeGreaterThanOrEqual(0);
    expect(disable).toBeGreaterThan(create);
    expect(h.fake.calls[create]?.body).toMatchObject({
      plan: planCode("starter-monthly-ngn"),
      start_date: sub.currentPeriodEnd?.toISOString(),
    });

    // Paystack sends not_renew for the old one immediately: not a cancellation.
    await h.deliver(
      subscriptionStatusEvent({
        event: "subscription.not_renew",
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        status: "non-renewing",
        planCode: planCode("pro-monthly-ngn"),
        customer: paid.customer,
      })
    );
    let current = await h.billing.getSubscription(organizationId);
    expect(current).toMatchObject({
      status: "active",
      planPriceId: "pro-monthly-ngn",
      scheduledPlanPriceId: "starter-monthly-ngn",
    });
    expect((await h.billing.getEntitlement(organizationId)).plan.key).toBe(
      "pro"
    );

    // Period ends; the new subscription's first charge arrives.
    h.clock.now = new Date((sub.currentPeriodEnd?.getTime() ?? 0) + 60_000);
    const replacement = h.fake.subscriptions.get(
      current?.scheduledSubscriptionCode ?? ""
    );
    if (replacement) {
      replacement.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    await h.deliver(
      chargeSuccess({
        reference: `renew_${organizationId}`,
        amount: 1_000_000,
        currency: "NGN",
        customer: paid.customer,
        planCode: planCode("starter-monthly-ngn"),
      })
    );
    current = await h.billing.getSubscription(organizationId);
    expect(current).toMatchObject({
      status: "active",
      planPriceId: "starter-monthly-ngn",
      paystackSubscriptionCode: replacement?.subscription_code,
      scheduledPlanPriceId: null,
    });
    expect(current?.currentPeriodEnd?.toISOString()).toBe(
      "2026-05-01T10:00:00.000Z"
    );
  });
});

describe("a second downgrade (audit #1: no orphaned scheduled subscription)", () => {
  const live = () =>
    [...h.fake.subscriptions.values()].filter((s) => s.status === "active");

  it("retires the earlier scheduled subscription when another downgrade is chosen", async () => {
    const { organizationId, actor, sub } =
      await h.subscribe("pro-annually-ngn");
    const first = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(first.kind).toBe("downgrade_scheduled");
    const afterFirst = await h.billing.getSubscription(organizationId);
    const firstCode = afterFirst?.scheduledSubscriptionCode ?? "";
    expect(firstCode).not.toBe("");

    const before = h.fake.calls.length;
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    const afterSecond = await h.billing.getSubscription(organizationId);
    const secondCode = afterSecond?.scheduledSubscriptionCode ?? "";
    expect(afterSecond?.scheduledPlanPriceId).toBe("starter-monthly-ngn");
    expect(secondCode).not.toBe(firstCode);

    // The first scheduled subscription is disabled and on record as replaced.
    expect(h.fake.subscriptions.get(firstCode)?.status).toBe("non-renewing");
    const [replaced] = await h.db
      .select()
      .from(schema.replacedSubscription)
      .where(
        eq(schema.replacedSubscription.paystackSubscriptionCode, firstCode)
      );
    expect(replaced?.disabledAt).not.toBeNull();
    // The already-retired current subscription is not disabled a second time.
    const disables = h.fake.calls
      .slice(before)
      .filter((c) => c.method === "POST" && c.path === "/subscription/disable");
    expect(disables.map((c) => (c.body as { code: string }).code)).toEqual([
      firstCode,
    ]);
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("non-renewing");

    // Exactly one subscription for this customer will still charge.
    const customerCode = h.fake.subscriptions.get(secondCode)?.customer;
    expect(
      live()
        .filter((s) => s.customer === customerCode)
        .map((s) => s.subscription_code)
    ).toEqual([secondCode]);
  });

  it("is idempotent when the same downgrade is requested twice", async () => {
    const { organizationId, actor } = await h.subscribe("pro-monthly-ngn");
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    const scheduled = await h.billing.getSubscription(organizationId);
    const before = h.fake.calls.length;
    const again = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    expect(again).toEqual({
      kind: "downgrade_scheduled",
      effectiveAt: scheduled?.currentPeriodEnd,
    });
    expect(h.fake.calls.slice(before)).toEqual([]);
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.scheduledSubscriptionCode).toBe(
      scheduled?.scheduledSubscriptionCode
    );
    expect(
      h.fake.subscriptions.get(after?.scheduledSubscriptionCode ?? "")?.status
    ).toBe("active");
  });
});

describe("keeping the current plan (undo a scheduled downgrade)", () => {
  it("starts a new subscription on the current plan at period end and retires the scheduled one", async () => {
    const { organizationId, actor, sub, paid } =
      await h.subscribe("pro-monthly-ngn");
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    const scheduled = await h.billing.getSubscription(organizationId);
    const scheduledCode = scheduled?.scheduledSubscriptionCode ?? "";

    const before = h.fake.calls.length;
    const result = await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(result).toEqual({ kind: "downgrade_canceled" });

    // Paystack can't re-enable the disabled current subscription.
    expect(h.fake.callsTo("POST", "/subscription/enable")).toEqual([]);
    const create = callIndex("POST", "/subscription", before);
    const disable = callIndex("POST", "/subscription/disable", before);
    expect(h.fake.calls[create]?.body).toMatchObject({
      plan: planCode("pro-monthly-ngn"),
      start_date: sub.currentPeriodEnd?.toISOString(),
    });
    expect(disable).toBeGreaterThan(create);
    expect(h.fake.calls[disable]?.body).toMatchObject({ code: scheduledCode });
    expect(h.fake.subscriptions.get(scheduledCode)?.status).toBe(
      "non-renewing"
    );

    const after = await h.billing.getSubscription(organizationId);
    expect(after).toMatchObject({
      status: "active",
      planPriceId: "pro-monthly-ngn",
      scheduledPlanPriceId: null,
      scheduledSubscriptionCode: null,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
    const kept = after?.paystackSubscriptionCode ?? "";
    expect(kept).not.toBe(sub.paystackSubscriptionCode);
    expect(kept).not.toBe(scheduledCode);
    expect(h.fake.subscriptions.get(kept)?.status).toBe("active");

    // Closing webhooks for the two retired codes change nothing.
    for (const code of [sub.paystackSubscriptionCode ?? "", scheduledCode]) {
      await h.deliver(
        subscriptionStatusEvent({
          event: "subscription.disable",
          subscriptionCode: code,
          status: "cancelled",
          planCode: planCode("pro-monthly-ngn"),
          customer: paid.customer,
        })
      );
    }
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      status: "active",
      paystackSubscriptionCode: kept,
    });

    // And it can still be cancelled afterwards.
    await h.billing.cancel({ organizationId, actor });
    expect(h.fake.subscriptions.get(kept)?.status).toBe("non-renewing");
  });

  it("leaves the downgrade scheduled if Paystack refuses the new subscription", async () => {
    const { organizationId, actor } = await h.subscribe("pro-monthly-ngn");
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    const scheduled = await h.billing.getSubscription(organizationId);
    h.fake.failNext("POST", /^\/subscription$/, 400, "Plan not found");
    await expect(
      h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: "pro-monthly-ngn",
        memberCount: 1,
      })
    ).rejects.toMatchObject({ code: "paystack_error" });
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      scheduledPlanPriceId: "starter-monthly-ngn",
      scheduledSubscriptionCode: scheduled?.scheduledSubscriptionCode,
    });
    expect(
      h.fake.subscriptions.get(scheduled?.scheduledSubscriptionCode ?? "")
        ?.status
    ).toBe("active");
  });
});

describe("cancel and resume (PLAN §2.3 #11)", () => {
  it("disables with the code and token from the database and keeps access", async () => {
    const { organizationId, actor, sub, paid } =
      await h.subscribe("pro-monthly-ngn");
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    const before = h.fake.calls.length;
    await h.billing.cancel({ organizationId, actor });
    const disable =
      h.fake.calls[callIndex("POST", "/subscription/disable", before)];
    expect(disable?.body).toEqual({
      code: remote?.subscription_code,
      token: remote?.email_token,
    });

    const after = await h.billing.getSubscription(organizationId);
    expect(after).toMatchObject({
      status: "non_renewing",
      cancelAtPeriodEnd: true,
    });
    expect((await h.billing.getEntitlement(organizationId)).active).toBe(true);

    await expect(
      h.billing.cancel({ organizationId, actor })
    ).rejects.toMatchObject({
      code: "invalid_state",
    });

    await h.billing.resume({ organizationId, actor });
    const resumed = await h.billing.getSubscription(organizationId);
    expect(resumed).toMatchObject({
      status: "active",
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    // Paystack can't re-enable a disabled subscription: resume starts a new
    // one on the same plan and card, first charged at the period end.
    expect(h.fake.callsTo("POST", "/subscription/enable")).toEqual([]);
    expect(remote?.status).toBe("non-renewing");
    expect(resumed?.paystackSubscriptionCode).not.toBe(
      remote?.subscription_code
    );
    const [create] = h.fake.callsTo("POST", "/subscription").slice(-1);
    expect(create?.body).toMatchObject({
      plan: planCode("pro-monthly-ngn"),
      start_date: sub.currentPeriodEnd?.toISOString(),
    });
    expect(
      h.fake.subscriptions.get(resumed?.paystackSubscriptionCode ?? "")?.status
    ).toBe("active");

    // The old subscription's closing webhook doesn't cancel the resumed one.
    await h.deliver(
      subscriptionStatusEvent({
        event: "subscription.disable",
        subscriptionCode: remote?.subscription_code ?? "",
        status: "cancelled",
        planCode: planCode("pro-monthly-ngn"),
        customer: paid.customer,
      })
    );
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      status: "active",
      paystackSubscriptionCode: resumed?.paystackSubscriptionCode,
    });

    // Cancel and resume again: same path, no 500.
    await h.billing.cancel({ organizationId, actor });
    await h.billing.resume({ organizationId, actor });
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      status: "active",
      cancelAtPeriodEnd: false,
    });
  });

  it("cancel succeeds when Paystack already has the subscription off", async () => {
    const { organizationId, actor, sub } = await h.subscribe("pro-monthly-ngn");
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    if (remote) {
      remote.status = "non-renewing";
    }
    await h.billing.cancel({ organizationId, actor });
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      status: "non_renewing",
      cancelAtPeriodEnd: true,
    });
  });

  it("cancel after a scheduled downgrade succeeds and retires the scheduled subscription", async () => {
    const { organizationId, actor, sub } = await h.subscribe("pro-monthly-ngn");
    await h.billing.changePlan({
      organizationId,
      actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    const scheduled = await h.billing.getSubscription(organizationId);
    const scheduledCode = scheduled?.scheduledSubscriptionCode ?? "";
    expect(scheduledCode).not.toBe("");
    // Scheduling disabled the current subscription on Paystack.
    expect(
      h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "")?.status
    ).toBe("non-renewing");

    const before = h.fake.calls.length;
    await h.billing.cancel({ organizationId, actor });

    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      status: "non_renewing",
      cancelAtPeriodEnd: true,
      planPriceId: "pro-monthly-ngn",
      scheduledPlanPriceId: null,
      scheduledSubscriptionCode: null,
    });
    // Only the scheduled one is disabled; the current one already was.
    const disables = h.fake
      .callsTo("POST", "/subscription/disable")
      .filter((c) => h.fake.calls.indexOf(c) >= before);
    expect(disables.map((c) => (c.body as { code: string }).code)).toEqual([
      scheduledCode,
    ]);
    expect(h.fake.subscriptions.get(scheduledCode)?.status).toBe(
      "non-renewing"
    );
  });

  it("cancel retries with Paystack's token when the stored one is stale", async () => {
    const { organizationId, actor, sub } = await h.subscribe("pro-monthly-ngn");
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    if (remote) {
      remote.email_token = "tok_rotated";
    }
    await h.billing.cancel({ organizationId, actor });
    expect(remote?.status).toBe("non-renewing");
  });

  it("resume reports a Paystack refusal as a billing error, not a crash", async () => {
    const { organizationId, actor } = await h.subscribe("pro-monthly-ngn");
    await h.billing.cancel({ organizationId, actor });
    h.fake.failNext("POST", /^\/subscription$/, 400, "Plan not found");
    await expect(
      h.billing.resume({ organizationId, actor })
    ).rejects.toMatchObject({ code: "paystack_error" });
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      status: "non_renewing",
    });
  });

  it("cannot resume after the period has ended", async () => {
    const { organizationId, actor, sub } = await h.subscribe("pro-monthly-ngn");
    await h.billing.cancel({ organizationId, actor });
    h.clock.now = new Date((sub.currentPeriodEnd?.getTime() ?? 0) + 1000);
    await expect(
      h.billing.resume({ organizationId, actor })
    ).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("returns Paystack's manage link for card updates", async () => {
    const { organizationId } = await h.subscribe("pro-monthly-ngn");
    expect(await h.billing.getManageCardLink(organizationId)).toContain(
      "/manage/"
    );
  });
});

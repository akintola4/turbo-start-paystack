import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { invoiceEvent, subscriptionStatusEvent } from "../src/fixtures";
import {
  type BillingDeps,
  type BillingNotification,
  transactionWithNotifications,
} from "../src/service/context";
import { type BillingHarness, planCode, setupBilling } from "./support";

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
const days = (n: number) => new Date(START.getTime() + n * 86_400_000);
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
});

const sentFor = (organizationId: string, type?: BillingNotification["type"]) =>
  h.notifications.filter(
    (n) => n.organizationId === organizationId && (!type || n.type === type)
  );

describe("billing notifications", () => {
  it("a first checkout sends one receipt keyed by the payment reference", async () => {
    const { organizationId, checkout, paid } =
      await h.subscribe("pro-monthly-ngn");
    const receipts = sentFor(organizationId, "payment_succeeded");
    expect(receipts).toEqual([
      expect.objectContaining({
        key: `receipt:${checkout.reference}`,
        planPriceId: "pro-monthly-ngn",
        amountSubunit: 3_000_000,
        currency: "NGN",
        reference: checkout.reference,
        periodStart: START,
        periodEnd: new Date("2026-04-01T10:00:00Z"),
      }),
    ]);
    // A re-sent charge.success (different body, same reference) is a no-op.
    await h.deliver({
      ...paid.charge,
      data: { ...paid.charge.data, id: 999 },
    });
    expect(sentFor(organizationId, "payment_succeeded")).toHaveLength(1);
  });

  it("a renewal sends a receipt with the new period", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    const code = sub.paystackSubscriptionCode ?? "";
    h.clock.now = new Date(sub.currentPeriodEnd ?? 0);
    const remote = h.fake.subscriptions.get(code);
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    await h.deliver({
      ...paid.charge,
      data: {
        ...paid.charge.data,
        reference: `renewal_${organizationId}`,
        metadata: "",
        paid_at: h.clock.now.toISOString(),
      },
    });
    expect(sentFor(organizationId, "payment_succeeded").at(-1)).toMatchObject({
      key: `receipt:renewal_${organizationId}`,
      reference: `renewal_${organizationId}`,
      periodStart: new Date("2026-04-01T10:00:00Z"),
      periodEnd: new Date("2026-05-01T10:00:00Z"),
    });
  });

  it("a failed renewal carries the grace deadline and plan", async () => {
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
    expect(sentFor(organizationId, "past_due")).toEqual([
      expect.objectContaining({
        planPriceId: "pro-monthly-ngn",
        graceUntil: days(7),
        key: `past_due:${sub.id}:${days(7).toISOString()}`,
      }),
    ]);
  });

  it("cancelling in the app emails once, even when Paystack's not_renew follows", async () => {
    const { organizationId, actor, sub, paid } = await h.subscribe();
    await h.billing.cancel({ organizationId, actor });
    await h.deliver(
      subscriptionStatusEvent({
        event: "subscription.not_renew",
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        status: "non-renewing",
        planCode: planCode("pro-monthly-ngn"),
        customer: paid.customer,
      })
    );
    expect(sentFor(organizationId, "subscription_canceled")).toEqual([
      expect.objectContaining({
        planPriceId: "pro-monthly-ngn",
        accessUntil: sub.currentPeriodEnd,
      }),
    ]);
  });

  it("a cancellation made on Paystack's side is emailed too", async () => {
    const { organizationId, sub, paid } = await h.subscribe();
    await h.deliver(
      subscriptionStatusEvent({
        event: "subscription.not_renew",
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        status: "non-renewing",
        planCode: planCode("pro-monthly-ngn"),
        customer: paid.customer,
      })
    );
    expect(sentFor(organizationId, "subscription_canceled")).toHaveLength(1);
  });

  it("an upgrade reports the prorated charge; a downgrade its effective date", async () => {
    const up = await h.subscribe("starter-monthly-ngn");
    h.clock.now = days(15);
    const result = await h.billing.changePlan({
      organizationId: up.organizationId,
      actor: up.actor,
      planPriceId: "pro-monthly-ngn",
      memberCount: 1,
    });
    expect(result.kind).toBe("upgraded");
    const charged = result.kind === "upgraded" ? result.charged : -1;
    expect(sentFor(up.organizationId, "plan_changed")).toEqual([
      expect.objectContaining({
        change: "upgrade",
        fromPlanPriceId: "starter-monthly-ngn",
        toPlanPriceId: "pro-monthly-ngn",
        chargedSubunit: charged,
        currency: "NGN",
        effectiveAt: days(15),
      }),
    ]);
    expect(charged).toBeGreaterThan(0);

    h.clock.now = START;
    const down = await h.subscribe("pro-monthly-ngn");
    await h.billing.changePlan({
      organizationId: down.organizationId,
      actor: down.actor,
      planPriceId: "starter-monthly-ngn",
      memberCount: 1,
    });
    expect(sentFor(down.organizationId, "plan_changed")).toEqual([
      expect.objectContaining({
        change: "downgrade",
        chargedSubunit: 0,
        effectiveAt: down.sub.currentPeriodEnd,
      }),
    ]);
  });

  it("nothing is sent for a plan change that fails", async () => {
    const { organizationId, actor } = await h.subscribe("pro-monthly-ngn");
    await expect(
      h.billing.changePlan({
        organizationId,
        actor,
        planPriceId: "pro-monthly-ngn",
        memberCount: 1,
      })
    ).rejects.toThrow();
    expect(sentFor(organizationId, "plan_changed")).toHaveLength(0);
  });
});

describe("trial-ending reminder", () => {
  async function startTrial() {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    await h.deliver(h.pay(checkout.reference).charge);
    const sub = await h.billing.getSubscription(org.organizationId);
    if (!sub) {
      throw new Error("no trial");
    }
    return { ...org, sub };
  }

  it("is sent once, three days before the trial ends", async () => {
    const { organizationId, sub } = await startTrial();
    expect(sentFor(organizationId, "trial_started")).toHaveLength(1);

    h.clock.now = days(10); // trial ends on day 14
    await h.billing.reconcile();
    expect(sentFor(organizationId, "trial_ending")).toHaveLength(0);

    h.clock.now = days(11.5);
    const report = await h.billing.reconcile();
    expect(report.trialRemindersSent).toBeGreaterThanOrEqual(1);
    expect(sentFor(organizationId, "trial_ending")).toEqual([
      {
        type: "trial_ending",
        organizationId,
        key: `trial_ending:${sub.id}`,
        planPriceId: "starter-monthly-ngn",
        trialEndsAt: days(14),
        amountSubunit: 1_000_000,
        currency: "NGN",
      },
    ]);
    const [row] = await h.db
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.id, sub.id));
    expect(row?.trialReminderSentAt).toEqual(days(11.5));

    h.clock.now = days(12);
    await h.billing.reconcile();
    expect(sentFor(organizationId, "trial_ending")).toHaveLength(1);
  });

  it("is not sent for a trial that was cancelled", async () => {
    const { organizationId, actor } = await startTrial();
    await h.billing.cancel({ organizationId, actor });
    h.clock.now = days(12);
    await h.billing.reconcile();
    expect(sentFor(organizationId, "trial_ending")).toHaveLength(0);
  });
});

describe("transactionWithNotifications", () => {
  function depsWith(sent: BillingNotification[], fail = false): BillingDeps {
    return {
      ...h.billing.deps,
      logger: { info() {}, warn() {}, error() {} },
      notify: async (n) => {
        if (fail) {
          throw new Error("smtp down");
        }
        sent.push(n);
      },
    };
  }
  const notice: BillingNotification = {
    type: "dispute",
    organizationId: "org_x",
    key: "dispute:x",
    reference: "x",
  };

  it("delivers only after commit and drops notices from a rollback", async () => {
    const sent: BillingNotification[] = [];
    const deps = depsWith(sent);
    await expect(
      transactionWithNotifications(deps, async (_tx, scoped) => {
        await scoped.notify?.(notice);
        expect(sent).toHaveLength(0);
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    expect(sent).toHaveLength(0);

    await transactionWithNotifications(deps, async (_tx, scoped) => {
      await scoped.notify?.(notice);
      expect(sent).toHaveLength(0);
    });
    expect(sent).toEqual([notice]);
  });

  it("a failing sender doesn't fail the committed work", async () => {
    const result = await transactionWithNotifications(
      depsWith([], true),
      async (_tx, scoped) => {
        await scoped.notify?.(notice);
        return "committed";
      }
    );
    expect(result).toBe("committed");
  });
});

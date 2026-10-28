import { type DbOrTx, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { addInterval, getPlanPrice } from "../catalog";
import type { PaystackSubscription } from "../paystack/types";
import { addDays, type BillingDeps, type SubscriptionRow } from "./context";

type LocalStatus = SubscriptionRow["status"];

/** Paystack subscription status → ours. */
export function mapRemoteStatus(
  status: string | undefined
): "active" | "non_renewing" | "past_due" | "ended" | "unknown" {
  switch (status) {
    case "active":
      return "active";
    case "non-renewing":
      return "non_renewing";
    case "attention":
      return "past_due";
    case "complete":
    case "completed":
    case "cancelled":
      return "ended";
    default:
      return "unknown";
  }
}

/** Swaps a scheduled downgrade in once the old period is over. */
export async function applyScheduledSwap(
  deps: BillingDeps,
  tx: DbOrTx,
  sub: SubscriptionRow,
  remote?: PaystackSubscription
): Promise<boolean> {
  if (!(sub.scheduledSubscriptionCode && sub.scheduledPlanPriceId)) {
    return false;
  }
  const now = deps.now();
  if (sub.currentPeriodEnd && now < sub.currentPeriodEnd) {
    return false;
  }
  const next =
    remote ??
    (await deps.paystack.fetchSubscription(sub.scheduledSubscriptionCode));
  const price = getPlanPrice(sub.scheduledPlanPriceId);
  const start = sub.currentPeriodEnd ?? now;
  const nextDate = next.next_payment_date
    ? new Date(next.next_payment_date)
    : null;
  await tx
    .update(schema.subscription)
    .set({
      planPriceId: sub.scheduledPlanPriceId,
      paystackSubscriptionCode: sub.scheduledSubscriptionCode,
      paystackEmailToken: sub.scheduledEmailToken,
      scheduledPlanPriceId: null,
      scheduledSubscriptionCode: null,
      scheduledEmailToken: null,
      status:
        mapRemoteStatus(next.status) === "past_due" ? "past_due" : "active",
      currentPeriodStart: start,
      currentPeriodEnd:
        nextDate && nextDate > start
          ? nextDate
          : price
            ? addInterval(start, price.interval)
            : start,
      cancelAtPeriodEnd: false,
      graceUntil: null,
    })
    .where(eq(schema.subscription.id, sub.id));
  return true;
}

/**
 * Re-derives local state from Paystack's view of the subscription. Used by
 * renewal charges and by reconcile, so the outcome doesn't depend on which
 * webhook arrived first (or at all).
 */
export async function resyncSubscription(
  deps: BillingDeps,
  tx: DbOrTx,
  sub: SubscriptionRow,
  hint?: { paidAt?: Date }
): Promise<void> {
  if (await applyScheduledSwap(deps, tx, sub)) {
    return;
  }
  if (!sub.paystackSubscriptionCode) {
    return;
  }
  const remote = await deps.paystack.fetchSubscription(
    sub.paystackSubscriptionCode
  );
  const now = deps.now();
  const mapped = mapRemoteStatus(remote.status);
  const next = remote.next_payment_date
    ? new Date(remote.next_payment_date)
    : null;
  const periodEnded = !sub.currentPeriodEnd || now >= sub.currentPeriodEnd;
  const patch: Partial<SubscriptionRow> = {};

  // Paystack moved the billing date forward: a renewal charge happened.
  const renewed =
    next !== null && (!sub.currentPeriodEnd || next > sub.currentPeriodEnd);

  if (mapped === "active") {
    // A trial only becomes active once its first charge is seen.
    const converted =
      sub.status !== "trialing" || Boolean(hint?.paidAt) || renewed;
    if (converted) {
      patch.status = "active" satisfies LocalStatus;
      patch.graceUntil = null;
      patch.cancelAtPeriodEnd = false;
    }
    if (renewed && converted) {
      patch.currentPeriodStart = hint?.paidAt ?? sub.currentPeriodEnd ?? now;
      patch.currentPeriodEnd = next;
    }
  } else if (mapped === "non_renewing") {
    patch.status = periodEnded ? "canceled" : "non_renewing";
    patch.cancelAtPeriodEnd = true;
    patch.canceledAt = sub.canceledAt ?? now;
    if (periodEnded) {
      patch.endedAt = now;
    }
  } else if (mapped === "past_due") {
    patch.status = "past_due";
    patch.graceUntil = sub.graceUntil ?? addDays(now, deps.graceDays);
  } else if (mapped === "ended") {
    patch.status = periodEnded ? "canceled" : "non_renewing";
    patch.cancelAtPeriodEnd = true;
    patch.canceledAt = sub.canceledAt ?? now;
    if (periodEnded) {
      patch.endedAt = now;
    }
  }

  if (Object.keys(patch).length > 0) {
    await tx
      .update(schema.subscription)
      .set(patch)
      .where(eq(schema.subscription.id, sub.id));
  }
}

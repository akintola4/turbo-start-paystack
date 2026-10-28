import {
  FREE_PLAN,
  getPlan,
  getPlanPrice,
  type PlanDefinition,
} from "./catalog";

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "non_renewing"
  | "canceled"
  | "expired";

export type EntitlementInput = {
  status: SubscriptionStatus;
  planPriceId: string;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  graceUntil: Date | null;
};

export type Entitlement = {
  active: boolean;
  plan: PlanDefinition;
  reason:
    | "no_subscription"
    | "trialing"
    | "active"
    | "non_renewing"
    | "past_due_grace"
    | "period_ended"
    | "grace_ended"
    | "canceled";
};

/** Time allowed after the period end for Paystack's renewal charge and its
 *  webhook to land before we stop granting access. */
export const RENEWAL_LEEWAY_MS = 24 * 60 * 60 * 1000;

function paid(
  plan: PlanDefinition,
  reason: Entitlement["reason"]
): Entitlement {
  return { active: true, plan, reason };
}

function free(reason: Entitlement["reason"]): Entitlement {
  return { active: false, plan: FREE_PLAN, reason };
}

/**
 * The only place that decides whether an organization gets paid features.
 * Computed on the server from stored state and the clock, so a cancelled or
 * expired subscription stops granting access even if no webhook ever arrives.
 */
export function getEntitlement(
  sub: EntitlementInput | null,
  now: Date
): Entitlement {
  if (!sub) {
    return free("no_subscription");
  }
  const price = getPlanPrice(sub.planPriceId);
  const plan = (price && getPlan(price.planKey)) ?? FREE_PLAN;
  const t = now.getTime();
  const periodOpen = (end: Date | null, leeway = 0) =>
    end !== null && t < end.getTime() + leeway;

  switch (sub.status) {
    case "trialing":
      return periodOpen(
        sub.trialEndsAt ?? sub.currentPeriodEnd,
        RENEWAL_LEEWAY_MS
      )
        ? paid(plan, "trialing")
        : free("period_ended");
    case "active":
      return periodOpen(sub.currentPeriodEnd, RENEWAL_LEEWAY_MS)
        ? paid(plan, "active")
        : free("period_ended");
    case "non_renewing":
      return periodOpen(sub.currentPeriodEnd)
        ? paid(plan, "non_renewing")
        : free("period_ended");
    case "past_due":
      return periodOpen(sub.graceUntil)
        ? paid(plan, "past_due_grace")
        : free("grace_ended");
    default:
      return free("canceled");
  }
}

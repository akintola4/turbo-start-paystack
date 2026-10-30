import type { SubscriptionStatus } from "@/lib/view-models";

/** What every role may see about the plan: no amounts, cards or invoices. */
export type PlanState = {
  name: string;
  /** null on Free. A cancelled-at-period-end plan reads as non_renewing. */
  status: SubscriptionStatus | null;
  /** When a non_renewing plan ends. Only for roles that can view billing. */
  endsAt: string | null;
};

export function planState(
  planName: string,
  sub: {
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null,
  { withDates }: { withDates: boolean }
): PlanState {
  if (!sub) {
    return { name: planName, status: null, endsAt: null };
  }
  const ending =
    sub.status === "non_renewing" ||
    (sub.cancelAtPeriodEnd && sub.status === "active");
  return {
    name: planName,
    status: ending ? "non_renewing" : sub.status,
    endsAt: ending && withDates ? sub.currentPeriodEnd : null,
  };
}

import type { BillingConfirm } from "@/components/billing/billing-action";
import { formatDate, intervalAdverb, intervalLabel } from "@/lib/format";
import type { PlanOption, SubscriptionSummary } from "@/lib/view-models";

/*
 * Plan picker copy. `plan.change` comes from `planChangeKind`, the rule the
 * billing service applies, so the dialog and toast say what the server will
 * do: an upgrade (including monthly to yearly on the same plan) applies now
 * and is prorated outside a trial; a downgrade waits for the period end.
 */

type Sub = Pick<
  SubscriptionSummary,
  "planName" | "status" | "currentPeriodEnd" | "trialEndsAt"
>;

export function planConfirm(
  plan: PlanOption,
  sub: Sub | null,
  orgName: string
): BillingConfirm | undefined {
  if (!(plan.action === "change-plan" && plan.price && sub)) {
    return;
  }
  const per = intervalLabel(plan.price.interval, "long");
  const billing = `${intervalAdverb(plan.price.interval)} billing`;
  if (plan.change === "upgrade") {
    const what = plan.intervalOnly ? billing : plan.name;
    return {
      title: plan.intervalOnly
        ? `Switch to ${billing}?`
        : `Upgrade to ${plan.name}?`,
      description: upgradeDescription(plan, sub, orgName, what, per),
      confirmLabel: actionLabel(plan),
      cancelLabel: "Not now",
    };
  }
  const until = formatDate(sub.currentPeriodEnd);
  return {
    title: plan.intervalOnly
      ? `Switch to ${billing}?`
      : `Switch to ${plan.name}?`,
    description: plan.intervalOnly
      ? `${orgName} keeps its current billing until ${until}, then pays ${plan.price.label} per ${per}. Nothing is charged today.`
      : `${orgName} keeps ${sub.planName} until ${until}, then moves to ${plan.name} at ${plan.price.label} per ${per}. Nothing is charged today.`,
    confirmLabel: actionLabel(plan),
    cancelLabel: "Not now",
  };
}

function upgradeDescription(
  plan: PlanOption,
  sub: Sub,
  orgName: string,
  what: string,
  per: string
) {
  const price = plan.price?.label ?? "";
  if (sub.status === "trialing") {
    return `${orgName} moves to ${what} now. You're still in the trial, so nothing is charged today; ${price} per ${per} from ${formatDate(sub.trialEndsAt)}.`;
  }
  const from = formatDate(sub.currentPeriodEnd);
  if (!plan.chargeNow?.subunit) {
    return `${orgName} moves to ${what} now. Nothing is charged today; ${price} per ${per} from ${from}.`;
  }
  return `${orgName} moves to ${what} now. Today we charge ${plan.chargeNow.label} to the card on file for the rest of this period, then ${price} per ${per} from ${from}.`;
}

export function actionLabel(plan: PlanOption) {
  if (plan.action === "checkout") {
    return plan.trialDays
      ? `Start ${plan.trialDays}-day trial`
      : `Choose ${plan.name}`;
  }
  if (plan.intervalOnly && plan.price) {
    return `Switch to ${intervalAdverb(plan.price.interval)} billing`;
  }
  return plan.change === "upgrade"
    ? `Upgrade to ${plan.name}`
    : `Switch to ${plan.name}`;
}

/** The toast once the server has answered. */
export function planChangeSuccess(
  plan: PlanOption,
  sub: Sub | null,
  orgName: string
) {
  const billing = plan.price
    ? `${intervalAdverb(plan.price.interval)} billing`
    : plan.name;
  if (plan.change === "upgrade") {
    return plan.intervalOnly
      ? `${orgName} is now on ${billing}`
      : `${orgName} is now on ${plan.name}`;
  }
  const when = formatDate(sub?.currentPeriodEnd ?? null);
  return plan.intervalOnly
    ? `${billing[0]?.toUpperCase()}${billing.slice(1)} starts on ${when}`
    : `${plan.name} starts on ${when}`;
}

import { formatDate } from "@/lib/format";
import type { SubscriptionSummary } from "@/lib/view-models";

export type PaymentOutcome = {
  kind: "success" | "loading" | "info" | "error";
  title: string;
  description: string;
};

/**
 * What the billing page says after Paystack checkout (`?payment=`). A trial
 * start only checked the card (refunded), so it says the trial started and
 * when the first charge is; a paid checkout says what was paid.
 */
export function paymentOutcome(
  payment: string,
  sub: Pick<
    SubscriptionSummary,
    "status" | "planName" | "priceLabel" | "trialEndsAt"
  > | null,
  { gaveUp = false }: { gaveUp?: boolean } = {}
): PaymentOutcome {
  if (payment === "succeeded" && sub?.status === "trialing") {
    return {
      kind: "success",
      title: "Trial started",
      description: `${sub.planName} is on. First charge ${sub.priceLabel} on ${formatDate(sub.trialEndsAt, "short")}; the card check was refunded.`,
    };
  }
  if (payment === "succeeded" && sub) {
    return {
      kind: "success",
      title: `${sub.priceLabel} paid`,
      description: `${sub.planName} is active.`,
    };
  }
  if (payment === "succeeded") {
    return {
      kind: "success",
      title: "Payment confirmed",
      description: "Your plan updates in a moment.",
    };
  }
  if (payment === "created" && gaveUp) {
    return {
      kind: "info",
      title: "Still waiting for Paystack",
      description:
        "We'll update the plan as soon as the payment is confirmed. You can leave this page.",
    };
  }
  if (payment === "created") {
    return {
      kind: "loading",
      title: "Confirming with Paystack…",
      description: "This usually takes a few seconds.",
    };
  }
  return {
    kind: "error",
    title: "Payment didn't go through",
    description: "Nothing was charged. Try again or use another card.",
  };
}

/** What the Free tile says, matched to what the page above offers. */
export function freeTileCopy(
  sub: Pick<
    SubscriptionSummary,
    "status" | "cancelAtPeriodEnd" | "currentPeriodEnd" | "planName"
  > | null
) {
  if (!sub) {
    return "Your organization is on this plan.";
  }
  if (sub.status === "past_due") {
    return "Moving to Free is paused until the failed payment is fixed.";
  }
  if (sub.status === "non_renewing" || sub.cancelAtPeriodEnd) {
    return `${sub.planName} already ends ${formatDate(sub.currentPeriodEnd, "short")}; then you're on Free.`;
  }
  return "To move to Free, cancel your plan above. You keep it until the period ends.";
}

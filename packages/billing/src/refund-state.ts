import type { schema } from "@workspace/db";

export type RefundState = NonNullable<
  (typeof schema.invoice.$inferSelect)["refundStatus"]
>;

/**
 * Where a refund stands, from whether Paystack accepted `POST /refund` and
 * every `refund.*` event stored for the charge
 * (https://paystack.com/docs/payments/refunds/). Order doesn't matter:
 * `processed` wins over anything, then `failed`, then `needs-attention`.
 * Pending and processing are both "pending". A refund Paystack never
 * accepted, with no events either, didn't go back: "failed".
 */
export function refundState(input: {
  requested: boolean;
  events: Iterable<string>;
}): RefundState {
  const seen = new Set(input.events);
  if (seen.has("refund.processed")) {
    return "processed";
  }
  if (seen.has("refund.failed")) {
    return "failed";
  }
  if (seen.has("refund.needs-attention")) {
    return "needs_attention";
  }
  if (
    input.requested ||
    seen.has("refund.pending") ||
    seen.has("refund.processing")
  ) {
    return "pending";
  }
  return "failed";
}

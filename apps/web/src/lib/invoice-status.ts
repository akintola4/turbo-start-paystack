import type { RefundState } from "@workspace/billing/refund-state";

/**
 * The status chip on an invoice, receipt or PDF. A void row is a refund, so
 * it shows where the refund stands rather than a flat "Refunded".
 */
export type InvoiceBadgeStatus =
  | "paid"
  | "pending"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "refund_failed"
  | "refund_delayed";

const REFUND_BADGE: Record<RefundState, InvoiceBadgeStatus> = {
  pending: "refund_pending",
  processed: "refunded",
  failed: "refund_failed",
  needs_attention: "refund_delayed",
};

export function invoiceBadgeStatus(
  status: "pending" | "paid" | "failed" | "void",
  refund: RefundState | null
): InvoiceBadgeStatus {
  if (status !== "void") {
    return status;
  }
  return REFUND_BADGE[refund ?? "pending"];
}

export const INVOICE_BADGE_LABEL: Record<InvoiceBadgeStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  refund_failed: "Refund failed",
  refund_delayed: "Refund delayed",
};

/** The refund chips, so each one can reserve the widest one's width. */
export const REFUND_BADGES = [
  "refund_pending",
  "refunded",
  "refund_failed",
  "refund_delayed",
] as const satisfies readonly InvoiceBadgeStatus[];

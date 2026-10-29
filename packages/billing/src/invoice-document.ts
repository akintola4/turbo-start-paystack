import type { schema } from "@workspace/db";

import { getPlan, getPlanPrice } from "./catalog";
import {
  type InvoiceParty,
  type InvoicingConfig,
  splitInclusiveTax,
} from "./invoicing";

type InvoiceRow = typeof schema.invoice.$inferSelect;

export type InvoiceDocumentStatus = "paid" | "pending" | "failed" | "refunded";

export type InvoiceLine = {
  description: string;
  /** Second line: interval and period, or why a line exists. */
  detail: string | null;
  /** Integer subunits; negative for refunds. */
  amountSubunit: number;
};

/**
 * Everything an invoice shows, in one serialisable shape. The web view and
 * the PDF both render this, so they can't disagree. Dates are ISO strings.
 */
export type InvoiceDocument = {
  id: string;
  /** "INV-2026-000123", or null for a charge that was never issued. */
  number: string | null;
  title: string;
  status: InvoiceDocumentStatus;
  kind: NonNullable<InvoiceRow["kind"]>;
  currency: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  issuedAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lines: InvoiceLine[];
  totals: {
    /** Before tax. Equals `total` when there is no tax. */
    netSubunit: number;
    taxSubunit: number;
    /** Basis points (750 = 7.5%); 0 when no tax applies. */
    taxRateBp: number;
    /** What was charged. */
    totalSubunit: number;
    /** Returned to the card (positive), or 0. */
    refundedSubunit: number;
    /** What the customer paid in the end: total − refunded, or 0 unpaid. */
    paidSubunit: number;
  };
  payment: { brand: string | null; last4: string } | null;
  /** Paystack transaction reference. */
  reference: string | null;
  paystackInvoiceCode: string | null;
};

const iso = (value: Date | null) => (value ? value.toISOString() : null);

function rangeLabel(start: Date | null, end: Date | null) {
  if (!(start && end)) {
    return null;
  }
  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`.replaceAll("Sept", "Sep");
}

function planLabel(planPriceId: string | null) {
  const price = planPriceId ? getPlanPrice(planPriceId) : undefined;
  const plan = price ? getPlan(price.planKey) : undefined;
  return {
    name: plan ? `${plan.name} plan` : null,
    interval: price
      ? price.interval === "annually"
        ? "Yearly"
        : "Monthly"
      : null,
  };
}

function statusOf(row: InvoiceRow): InvoiceDocumentStatus {
  if (row.status === "void") {
    return "refunded";
  }
  return row.status;
}

function titleOf(row: InvoiceRow, status: InvoiceDocumentStatus) {
  if (row.kind === "card_check") {
    return "Card check";
  }
  if (row.number) {
    return "Invoice";
  }
  return {
    refunded: "Refunded charge",
    failed: "Failed payment",
    pending: "Upcoming invoice",
    paid: "Receipt",
  }[status];
}

/** The charged line: what the money was for. */
function chargeLine(row: InvoiceRow, amountSubunit: number): InvoiceLine {
  const plan = planLabel(row.planPriceId);
  const period = rangeLabel(row.periodStart, row.periodEnd);
  const detail = (...parts: (string | null)[]) =>
    parts.filter(Boolean).join(" · ") || null;
  switch (row.kind) {
    case "card_check":
      return {
        description: "Card check",
        detail: "Saves the card for the trial. Refunded straight away.",
        amountSubunit,
      };
    case "proration":
      return {
        description: plan.name ? `Upgrade to ${plan.name}` : "Plan upgrade",
        detail: detail("Prorated for the rest of the period", period),
        amountSubunit,
      };
    default:
      return {
        description:
          plan.name ??
          (row.description ?? "Subscription").replace(/\s*\(.*\)$/, ""),
        detail: detail(plan.interval, period),
        amountSubunit,
      };
  }
}

/**
 * Builds the invoice from its row. Seller, buyer and tax come from the
 * snapshot taken at issue; rows never issued (refunds, failures, rows from
 * before numbering) use `current` instead.
 */
export function buildInvoiceDocument(
  row: InvoiceRow,
  current: { config: InvoicingConfig; buyer: InvoiceParty }
): InvoiceDocument {
  const status = statusOf(row);
  const issued = row.number !== null && row.seller !== null;
  const taxRateBp = issued ? (row.taxRateBp ?? 0) : 0;
  const total = row.amountSubunit;
  const split =
    issued && row.netSubunit !== null && row.taxSubunit !== null
      ? { netSubunit: row.netSubunit, taxSubunit: row.taxSubunit }
      : splitInclusiveTax(total, taxRateBp);
  const refunded = status === "refunded" ? total : 0;

  // A refund shows in the totals ("Refunded on …"), not as a second line.
  const lines = [chargeLine(row, split.netSubunit)];
  return {
    id: row.id,
    number: row.number,
    title: titleOf(row, status),
    status,
    kind: row.kind ?? (row.paystackInvoiceCode ? "renewal" : "subscription"),
    currency: row.currency,
    seller: issued ? (row.seller as InvoiceParty) : current.config.seller,
    buyer: issued && row.buyer ? (row.buyer as InvoiceParty) : current.buyer,
    issuedAt: iso(row.issuedAt ?? row.paidAt ?? row.createdAt),
    paidAt: iso(row.paidAt),
    refundedAt: iso(row.refundedAt),
    periodStart: iso(row.periodStart),
    periodEnd: iso(row.periodEnd),
    lines,
    totals: {
      netSubunit: split.netSubunit,
      taxSubunit: split.taxSubunit,
      taxRateBp,
      totalSubunit: total,
      refundedSubunit: refunded,
      paidSubunit:
        status === "paid" || status === "refunded" ? total - refunded : 0,
    },
    payment: row.cardLast4
      ? { brand: row.cardBrand, last4: row.cardLast4 }
      : null,
    reference: row.reference,
    paystackInvoiceCode: row.paystackInvoiceCode,
  };
}

/** `INV-2026-000123-kola-logistics.pdf`. Only safe filename characters. */
export function invoiceFilename(doc: InvoiceDocument, orgSlug: string) {
  const base = doc.number ?? `receipt-${doc.id.slice(0, 8)}`;
  const slug = orgSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${[base, slug].filter(Boolean).join("-")}.pdf`;
}

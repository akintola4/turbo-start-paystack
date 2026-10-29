import type {
  InvoiceDocument,
  InvoiceDocumentStatus,
  InvoiceParty,
} from "@workspace/billing";
import { formatMoney } from "@workspace/billing/money";

/**
 * The invoice as display strings. The web view and the PDF render this one
 * shape, so wording, order and amounts can't drift apart.
 */
export type InvoiceView = {
  /** "Invoice", "Refunded charge", "Card check"… */
  title: string;
  /** The seller's two-letter mark: "Turbo Start Ltd" → "TS". */
  mark: string;
  number: string | null;
  status: InvoiceDocumentStatus;
  statusLabel: string;
  /** Amount charged, e.g. "₦10,000.00". */
  amount: string;
  /** The same at display size: ".00" dropped, as on the billing panel. */
  heroAmount: string;
  /** The hero amount is struck through (refunded). */
  struck: boolean;
  /** Under the amount: "Paid on 12 November 2026". */
  caption: string;
  /** Facts in a row: issued, period, payment method… */
  meta: { label: string; value: string }[];
  from: { name: string; lines: string[] };
  to: { name: string; lines: string[] };
  lines: { description: string; detail: string | null; amount: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  reference: string | null;
  paystackInvoiceCode: string | null;
  currency: string;
};

const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const formatLongDate = (iso: string) => longDate.format(new Date(iso));
const formatShortDate = (iso: string) =>
  shortDate.format(new Date(iso)).replace("Sept", "Sep");

const STATUS_LABEL: Record<InvoiceDocumentStatus, string> = {
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
  pending: "Pending",
};

/** 750 → "7.5%". */
export const ratePercent = (bp: number) =>
  `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

function partyLines(party: InvoiceParty) {
  return [
    ...(party.address?.split("\n").filter(Boolean) ?? []),
    party.email,
    party.taxId ? `Tax ID ${party.taxId}` : null,
    party.vatNumber ? `VAT no. ${party.vatNumber}` : null,
  ].filter((line): line is string => Boolean(line));
}

function caption(doc: InvoiceDocument) {
  switch (doc.status) {
    case "paid":
      return doc.paidAt ? `Paid on ${formatLongDate(doc.paidAt)}` : "Paid";
    case "refunded":
      return doc.refundedAt
        ? `Refunded on ${formatLongDate(doc.refundedAt)}`
        : "Refunded";
    case "failed":
      return doc.periodStart
        ? `Payment failed. Due ${formatLongDate(doc.periodStart)}`
        : "Payment failed";
    default:
      return doc.periodStart
        ? `Due ${formatLongDate(doc.periodStart)}`
        : "Not paid yet";
  }
}

function totals(doc: InvoiceDocument) {
  const money = (n: number) => formatMoney(n, doc.currency);
  const t = doc.totals;
  const rows: InvoiceView["totals"] = [];
  if (t.taxRateBp > 0) {
    rows.push(
      { label: "Subtotal", value: money(t.netSubunit) },
      { label: `VAT (${ratePercent(t.taxRateBp)})`, value: money(t.taxSubunit) }
    );
  }
  switch (doc.status) {
    case "paid":
      rows.push({
        label: "Total paid",
        value: money(t.totalSubunit),
        strong: true,
      });
      break;
    case "refunded":
      rows.push(
        { label: "Charged", value: money(t.totalSubunit) },
        {
          label: doc.refundedAt
            ? `Refunded ${formatShortDate(doc.refundedAt)}`
            : "Refunded",
          value: money(-t.refundedSubunit),
        },
        { label: "Total paid", value: money(t.paidSubunit), strong: true }
      );
      break;
    default:
      rows.push({
        label: "Amount due",
        value: money(t.totalSubunit),
        strong: true,
      });
  }
  return rows;
}

export function invoiceView(doc: InvoiceDocument): InvoiceView {
  const meta: InvoiceView["meta"] = [];
  if (doc.issuedAt && doc.number) {
    meta.push({ label: "Issued", value: formatShortDate(doc.issuedAt) });
  }
  if (doc.periodStart && doc.periodEnd) {
    meta.push({
      label: "Period",
      value: `${formatShortDate(doc.periodStart)} – ${formatShortDate(doc.periodEnd)}`,
    });
  }
  if (doc.payment) {
    const brand = doc.payment.brand
      ? doc.payment.brand.charAt(0).toUpperCase() + doc.payment.brand.slice(1)
      : "Card";
    meta.push({
      label: "Paid with",
      value: `${brand} ending ${doc.payment.last4}`,
    });
  }
  return {
    title: doc.title,
    mark:
      doc.seller.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "·",
    number: doc.number,
    status: doc.status,
    statusLabel: STATUS_LABEL[doc.status],
    amount: formatMoney(doc.totals.totalSubunit, doc.currency),
    heroAmount: formatMoney(doc.totals.totalSubunit, doc.currency).replace(
      /\.00$/,
      ""
    ),
    struck: doc.status === "refunded",
    caption: caption(doc),
    meta,
    from: { name: doc.seller.name, lines: partyLines(doc.seller) },
    to: { name: doc.buyer.name, lines: partyLines(doc.buyer) },
    lines: doc.lines.map((line) => ({
      description: line.description,
      detail: line.detail,
      amount: formatMoney(line.amountSubunit, doc.currency),
    })),
    totals: totals(doc),
    reference: doc.reference,
    paystackInvoiceCode: doc.paystackInvoiceCode,
    currency: doc.currency,
  };
}

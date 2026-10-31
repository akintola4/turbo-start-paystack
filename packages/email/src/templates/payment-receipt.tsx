import { type DetailRow, type EmailContent, money, strong } from "../content";
import { Email } from "../components/email";
import {
  formatDate,
  formatInterval,
  formatMoney,
  formatShortDate,
} from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type PaymentReceiptProps = {
  organizationName: string;
  planName: string;
  interval: string;
  amountSubunit: number;
  currency: string;
  reference: string;
  paidAt: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  billingUrl: string;
  /** The invoice for this payment, viewable and downloadable as a PDF. */
  invoiceUrl: string;
};

export const paymentReceiptSubject = (p: PaymentReceiptProps) =>
  oneLine(
    `Receipt for ${formatMoney(p.amountSubunit, p.currency)}: ${p.organizationName}`
  );

export function paymentReceiptContent(
  props: PaymentReceiptProps,
  theme: EmailTheme
): EmailContent {
  const amount = formatMoney(props.amountSubunit, props.currency);
  const interval = formatInterval(props.interval);
  const rows: DetailRow[] = [
    { label: "Amount paid", value: amount, money: true, isHero: true },
    { label: "Plan", value: `${props.planName} (${interval})` },
  ];
  if (props.periodStart && props.periodEnd) {
    rows.push({
      label: "Period",
      value: `${formatShortDate(props.periodStart)} – ${formatShortDate(props.periodEnd)}`,
      tile: true,
    });
    rows.push({
      label: "Renews",
      value: formatDate(props.periodEnd),
      tile: true,
    });
  }
  rows.push(
    { label: "Paid on", value: formatDate(props.paidAt), isHero: true },
    { label: "Reference", value: props.reference, mono: true }
  );
  return {
    billing: true,
    preview: `${amount} received for ${props.organizationName}. Keep this for your records.`,
    status: { tone: "success", label: "Paid", icon: "circle-check" },
    title: `${props.planName} plan`,
    headline: "Payment received",
    hero: {
      kind: "money",
      amountSubunit: props.amountSubunit,
      currency: props.currency,
      caption: `Paid on ${formatDate(props.paidAt)}`,
    },
    body: [
      [
        "We received ",
        money(amount),
        " for ",
        strong(props.organizationName),
        ". Thank you.",
      ],
    ],
    details: { title: "Receipt", rows },
    cta: { label: "View invoice", href: props.invoiceUrl },
    after: [
      [
        "Paystack sends its own receipt to the card holder. Quote the reference if you contact us about this payment.",
      ],
    ],
    reason: billingReason(props.organizationName, theme),
  };
}

export function PaymentReceipt(props: Themed<PaymentReceiptProps>) {
  const theme = themeOf(props);
  return <Email content={paymentReceiptContent(props, theme)} theme={theme} />;
}

PaymentReceipt.PreviewProps = {
  organizationName: "Kola Logistics",
  planName: "Pro",
  interval: "monthly",
  amountSubunit: 3_000_000,
  currency: "NGN",
  reference: "tsp-4f7d2a9c81e64b0f9a3e5c2d7b1a6e90",
  paidAt: new Date("2026-10-12T09:12:00Z"),
  periodStart: new Date("2026-10-12T09:12:00Z"),
  periodEnd: new Date("2026-11-12T09:12:00Z"),
  billingUrl: "https://app.example.com/app/kola/settings/billing",
  invoiceUrl:
    "https://app.example.com/app/kola/settings/billing/invoices/0b6c6a8e-3f1d-4c55-9a51-7d2e1f0c4b9a",
} satisfies PaymentReceiptProps;

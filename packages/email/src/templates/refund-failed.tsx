import { type DetailRow, type EmailContent, strong } from "../content";
import { Email } from "../components/email";
import { formatMoney } from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type RefundFailedProps = {
  organizationName: string;
  /** The charge that was being refunded. */
  reference: string;
  /** What was being refunded, when we know it. */
  amountSubunit: number | null;
  currency: string | null;
  billingUrl: string;
};

export const refundFailedSubject = (p: RefundFailedProps) =>
  oneLine(`A refund to ${p.organizationName} didn't go through`);

export function refundFailedContent(
  props: RefundFailedProps,
  theme: EmailTheme
): EmailContent {
  const amount =
    props.amountSubunit !== null && props.currency
      ? formatMoney(props.amountSubunit, props.currency)
      : null;
  const rows: DetailRow[] = [];
  if (amount) {
    rows.push({ label: "Amount", value: amount, money: true });
  }
  rows.push({ label: "Reference", value: props.reference, mono: true });
  return {
    billing: true,
    preview: "Paystack couldn't return a refund to your card. We're on it.",
    status: {
      tone: "warning",
      label: "Refund delayed",
      icon: "triangle-alert",
    },
    title: "Refund didn't go through",
    headline: "Your refund didn't reach your card",
    body: [
      [
        "We refunded a payment from ",
        strong(props.organizationName),
        ", but Paystack couldn't send the money back to the card. ",
        strong("It hasn't reached you yet."),
      ],
      [
        "We've been told and will sort it out. You don't need to do anything. If you have questions, contact our support team with the reference below.",
      ],
    ],
    details: { title: "Refund", rows },
    cta: { label: "View billing", href: props.billingUrl },
    reason: billingReason(props.organizationName, theme),
  };
}

export function RefundFailed(props: Themed<RefundFailedProps>) {
  const theme = themeOf(props);
  return <Email content={refundFailedContent(props, theme)} theme={theme} />;
}

RefundFailed.PreviewProps = {
  organizationName: "Kola Logistics",
  reference: "tsp-4f7d2a9c81e64b0f9a3e5c2d7b1a6e90",
  amountSubunit: 5000,
  currency: "NGN",
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies RefundFailedProps;

import { type EmailContent, strong } from "../content";
import { Email } from "../components/email";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type PaymentDisputedProps = {
  organizationName: string;
  reference: string;
  billingUrl: string;
};

export const paymentDisputedSubject = (p: PaymentDisputedProps) =>
  oneLine(`A payment for ${p.organizationName} was disputed`);

export function paymentDisputedContent(
  props: PaymentDisputedProps,
  theme: EmailTheme
): EmailContent {
  return {
    billing: true,
    preview:
      "The card holder's bank opened a chargeback on one of your payments.",
    status: { tone: "danger", label: "Disputed", icon: "circle-x" },
    title: "Payment dispute",
    headline: "A payment was disputed",
    body: [
      [
        "The bank behind the card for ",
        strong(props.organizationName),
        " opened a dispute (a chargeback) on the payment below. Paystack emails the details and the deadline to respond.",
      ],
      [
        "If nobody on your team meant to dispute it, contact the bank or our support team and quote the reference.",
      ],
    ],
    details: {
      title: "Disputed payment",
      rows: [{ label: "Reference", value: props.reference, mono: true }],
    },
    cta: { label: "View billing", href: props.billingUrl },
    reason: billingReason(props.organizationName, theme),
  };
}

export function PaymentDisputed(props: Themed<PaymentDisputedProps>) {
  const theme = themeOf(props);
  return <Email content={paymentDisputedContent(props, theme)} theme={theme} />;
}

PaymentDisputed.PreviewProps = {
  organizationName: "Kola Logistics",
  reference: "tsp_4f7d2a9c81e64b0f9a3e5c2d7b1a6e90",
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies PaymentDisputedProps;

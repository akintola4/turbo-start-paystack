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
      "Your bank disputed a payment. Your plan stays active while it's reviewed.",
    status: { tone: "danger", label: "Disputed", icon: "circle-x" },
    title: "Payment dispute",
    headline: "Your bank disputed a payment",
    body: [
      [
        "The bank that issued the card for ",
        strong(props.organizationName),
        " has disputed (charged back) the payment below. ",
        strong("Your plan stays active while it's reviewed."),
      ],
      [
        "If you meant to dispute it, you don't need to do anything else here. Your bank will keep you updated.",
      ],
      [
        "If you didn't, ask your bank to withdraw the dispute, then contact our support team with the reference below so we can help. If you think the card was used without permission, tell your bank that too.",
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
  reference: "tsp-4f7d2a9c81e64b0f9a3e5c2d7b1a6e90",
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies PaymentDisputedProps;

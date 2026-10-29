import { type EmailContent, link, strong } from "../content";
import { Email } from "../components/email";
import { formatDate } from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type PaymentFailedProps = {
  organizationName: string;
  planName: string;
  graceUntil: Date;
  /** Paystack's hosted page for changing the card on the subscription, or
   *  the billing page when Paystack didn't return one. */
  manageUrl: string;
  billingUrl: string;
};

export const paymentFailedSubject = (p: PaymentFailedProps) =>
  oneLine(`Payment failed for ${p.organizationName}: update your card`);

const dayMonth = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);

export function paymentFailedContent(
  props: PaymentFailedProps,
  theme: EmailTheme
): EmailContent {
  const deadline = formatDate(props.graceUntil);
  return {
    billing: true,
    preview: `Update the card by ${deadline} to keep ${props.planName}.`,
    status: {
      tone: "warning",
      label: "Payment failed",
      icon: "triangle-alert",
    },
    title: `${props.planName} plan`,
    headline: "Your payment didn't go through",
    hero: {
      kind: "date",
      text: `Update by ${dayMonth(props.graceUntil)}`,
      caption: `Your team keeps ${props.planName} until then.`,
    },
    body: [
      [
        `We couldn't charge the card for the ${props.planName} plan on `,
        strong(props.organizationName),
        ". Cards usually fail because they've expired, hit their limit, or the bank declined the charge.",
      ],
    ],
    callout: {
      tone: "warning",
      text: [
        "If the card isn't updated by ",
        strong(deadline),
        `, the subscription is cancelled and ${props.organizationName} moves to the Free plan.`,
      ],
    },
    cta: { label: "Update card", href: props.manageUrl, urgent: true },
    after: [
      [
        "The button opens Paystack's secure page for this subscription. Paystack retries the charge once the new card is saved. You can also do this from the ",
        link("billing page", props.billingUrl),
        ".",
      ],
    ],
    reason: billingReason(props.organizationName, theme),
  };
}

export function PaymentFailed(props: Themed<PaymentFailedProps>) {
  const theme = themeOf(props);
  return <Email content={paymentFailedContent(props, theme)} theme={theme} />;
}

PaymentFailed.PreviewProps = {
  organizationName: "Kola Logistics",
  planName: "Pro",
  graceUntil: new Date("2026-11-04T09:00:00Z"),
  manageUrl: "https://paystack.com/manage/subscriptions/qlgwhpyq1ts9nsw",
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies PaymentFailedProps;

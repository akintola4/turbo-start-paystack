import { type EmailContent, strong } from "../content";
import { Email } from "../components/email";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type CardExpiringProps = {
  organizationName: string;
  manageUrl: string;
};

export const cardExpiringSubject = (p: CardExpiringProps) =>
  oneLine(`The card for ${p.organizationName} expires soon`);

export function cardExpiringContent(
  props: CardExpiringProps,
  theme: EmailTheme
): EmailContent {
  return {
    billing: true,
    preview: "Update it before the next renewal so the payment goes through.",
    status: { tone: "warning", label: "Card expiring", icon: "credit-card" },
    title: "Card on file",
    headline: "Your card expires soon",
    body: [
      [
        "The card paying for ",
        strong(props.organizationName),
        " expires before the next renewal. Swap it for a current card now and the renewal goes through as normal.",
      ],
    ],
    cta: { label: "Update card", href: props.manageUrl, urgent: true },
    after: [
      [
        "It takes a minute on Paystack's secure page. Nothing is charged when you update the card.",
      ],
    ],
    reason: billingReason(props.organizationName, theme),
  };
}

export function CardExpiring(props: Themed<CardExpiringProps>) {
  const theme = themeOf(props);
  return <Email content={cardExpiringContent(props, theme)} theme={theme} />;
}

CardExpiring.PreviewProps = {
  organizationName: "Kola Logistics",
  manageUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies CardExpiringProps;

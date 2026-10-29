import { type EmailContent, money, strong } from "../content";
import { Email } from "../components/email";
import { formatDate, formatInterval, formatMoney } from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type TrialEndingProps = {
  organizationName: string;
  planName: string;
  interval: string;
  trialEndsAt: Date;
  amountSubunit: number;
  currency: string;
  billingUrl: string;
};

export const trialEndingSubject = (p: TrialEndingProps) =>
  oneLine(
    `Your ${p.planName} trial for ${p.organizationName} ends on ${formatDate(p.trialEndsAt)}`
  );

export function trialEndingContent(
  props: TrialEndingProps,
  theme: EmailTheme
): EmailContent {
  const amount = formatMoney(props.amountSubunit, props.currency);
  const date = formatDate(props.trialEndsAt);
  const interval = formatInterval(props.interval);
  return {
    billing: true,
    preview: `${amount} will be charged on ${date} unless you cancel.`,
    status: {
      tone: "info",
      label: `Trial ends ${date.replace(/ \d{4}$/, "")}`,
      icon: "hourglass",
    },
    title: `${props.planName} plan`,
    headline: `Your trial ends on ${date.replace(/ \d{4}$/, "")}`,
    hero: {
      kind: "money",
      amountSubunit: props.amountSubunit,
      currency: props.currency,
      unit: interval === "yearly" ? "/ year" : "/ month",
      caption: "First charge, when the trial ends",
    },
    body: [
      [
        `The ${props.planName} trial for `,
        strong(props.organizationName),
        ` ends on ${date}. If you're keeping it, there's nothing to do: we'll charge `,
        money(amount),
        " to the card you added.",
      ],
    ],
    details: {
      title: "First charge",
      rows: [
        { label: "Plan", value: `${props.planName} (${interval})`, tile: true },
        { label: "First charge", value: amount, money: true, isHero: true },
        { label: "Charged on", value: date, tile: true },
      ],
    },
    cta: { label: "Manage subscription", href: props.billingUrl },
    after: [
      [
        `Not keeping it? Cancel from the billing page before ${date} and nothing is charged.`,
      ],
    ],
    reason: billingReason(props.organizationName, theme),
  };
}

export function TrialEnding(props: Themed<TrialEndingProps>) {
  const theme = themeOf(props);
  return <Email content={trialEndingContent(props, theme)} theme={theme} />;
}

TrialEnding.PreviewProps = {
  organizationName: "Kola Logistics",
  planName: "Starter",
  interval: "monthly",
  trialEndsAt: new Date("2026-10-31T09:00:00Z"),
  amountSubunit: 15_000,
  currency: "GHS",
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies TrialEndingProps;

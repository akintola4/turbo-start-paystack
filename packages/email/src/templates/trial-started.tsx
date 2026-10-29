import { type EmailContent, strong } from "../content";
import { Email } from "../components/email";
import { formatDate } from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type TrialStartedProps = {
  organizationName: string;
  planName: string;
  trialEndsAt: Date;
  billingUrl: string;
};

export const trialStartedSubject = (p: TrialStartedProps) =>
  oneLine(`Your ${p.planName} trial for ${p.organizationName} has started`);

const dayMonth = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);

export function trialStartedContent(
  props: TrialStartedProps,
  theme: EmailTheme
): EmailContent {
  const date = formatDate(props.trialEndsAt);
  return {
    billing: true,
    preview: `${props.planName} is free until ${date}. We'll remind you three days before.`,
    status: { tone: "info", label: "Trial", icon: "hourglass" },
    title: `${props.planName} plan`,
    headline: `Your ${props.planName} trial has started`,
    hero: {
      kind: "date",
      text: `Free until ${dayMonth(props.trialEndsAt)}`,
      caption: "Every feature, no charge until then.",
    },
    body: [
      [
        strong(props.organizationName),
        ` has the full ${props.planName} plan until `,
        strong(date),
        ". The small charge we made to check your card has been refunded.",
      ],
      [
        `We'll email you three days before the trial ends. If you keep ${props.planName}, the card is charged on ${date}.`,
      ],
    ],
    cta: { label: "View billing", href: props.billingUrl },
    reason: billingReason(props.organizationName, theme),
  };
}

export function TrialStarted(props: Themed<TrialStartedProps>) {
  const theme = themeOf(props);
  return <Email content={trialStartedContent(props, theme)} theme={theme} />;
}

TrialStarted.PreviewProps = {
  organizationName: "Kola Logistics",
  planName: "Starter",
  trialEndsAt: new Date("2026-11-11T09:00:00Z"),
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies TrialStartedProps;

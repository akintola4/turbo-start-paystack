import { type EmailContent, strong } from "../content";
import { Email } from "../components/email";
import { formatDate } from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { billingReason, type Themed, themeOf } from "./shared";

export type SubscriptionCanceledProps = {
  organizationName: string;
  planName: string;
  /** End of the paid (or trial) period. Null if unknown. */
  accessUntil: Date | null;
  resumeUrl: string;
};

export const subscriptionCanceledSubject = (p: SubscriptionCanceledProps) =>
  oneLine(`Your ${p.planName} plan for ${p.organizationName} won't renew`);

const dayMonth = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);

export function subscriptionCanceledContent(
  props: SubscriptionCanceledProps,
  theme: EmailTheme
): EmailContent {
  const until = props.accessUntil ? formatDate(props.accessUntil) : null;
  return {
    billing: true,
    preview: until
      ? `You keep ${props.planName} until ${until}.`
      : `${props.planName} won't renew.`,
    status: {
      tone: "quiet",
      label: props.accessUntil
        ? `Ends ${dayMonth(props.accessUntil)}`
        : "Cancelled",
      icon: "calendar-x",
    },
    title: `${props.planName} plan`,
    headline: "Your subscription won't renew",
    hero: until
      ? {
          kind: "date",
          text: `Until ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(props.accessUntil as Date)}`,
          caption: `Your last day on ${props.planName}. Then Free.`,
        }
      : undefined,
    body: [
      [
        `The ${props.planName} plan for `,
        strong(props.organizationName),
        " won't renew, and we won't charge the card again. ",
        ...(until
          ? [
              `Your team keeps ${props.planName} until `,
              strong(until),
              ", then moves to the Free plan.",
            ]
          : [
              "The organization moves to the Free plan when the current period ends.",
            ]),
      ],
      ["Changed your mind? Resume before then and nothing changes."],
    ],
    cta: { label: `Resume ${props.planName}`, href: props.resumeUrl },
    reason: billingReason(props.organizationName, theme),
  };
}

export function SubscriptionCanceled(props: Themed<SubscriptionCanceledProps>) {
  const theme = themeOf(props);
  return (
    <Email content={subscriptionCanceledContent(props, theme)} theme={theme} />
  );
}

SubscriptionCanceled.PreviewProps = {
  organizationName: "Kola Logistics",
  planName: "Pro",
  accessUntil: new Date("2026-11-12T09:12:00Z"),
  resumeUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies SubscriptionCanceledProps;

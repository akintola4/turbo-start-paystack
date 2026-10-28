import { Layout } from "../components/layout";
import { Button, Heading, Strong, Text } from "../components/primitives";
import { formatDate } from "../format";
import { oneLine } from "../links";
import { billingReason, type Themed, themeOf } from "./shared";

export type TrialStartedProps = {
  organizationName: string;
  planName: string;
  trialEndsAt: Date;
  billingUrl: string;
};

export const trialStartedSubject = (p: TrialStartedProps) =>
  oneLine(`Your ${p.planName} trial for ${p.organizationName} has started`);

export function TrialStarted(props: Themed<TrialStartedProps>) {
  const theme = themeOf(props);
  const date = formatDate(props.trialEndsAt);
  return (
    <Layout
      preview={`${props.planName} is free until ${date}.`}
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>Your trial has started</Heading>
      <Text theme={theme}>
        <Strong theme={theme}>{props.organizationName}</Strong> has full access
        to <Strong theme={theme}>{props.planName}</Strong> until{" "}
        <Strong theme={theme}>{date}</Strong>. The small charge used to verify
        your card has been refunded.
      </Text>
      <Text theme={theme}>
        We'll remind you a few days before the trial ends. If you keep the plan,
        your card is charged on {date}.
      </Text>
      <Button theme={theme} fallback={false} href={props.billingUrl} last>
        View billing
      </Button>
    </Layout>
  );
}

TrialStarted.PreviewProps = {
  organizationName: "Acme Logistics",
  planName: "Starter",
  trialEndsAt: new Date("2026-11-11T09:00:00Z"),
  billingUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies TrialStartedProps;

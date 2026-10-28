import { Layout } from "../components/layout";
import { Button, Heading, Strong, Text } from "../components/primitives";
import { formatDate } from "../format";
import { oneLine } from "../links";
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

export function SubscriptionCanceled(props: Themed<SubscriptionCanceledProps>) {
  const theme = themeOf(props);
  const until = props.accessUntil ? formatDate(props.accessUntil) : null;
  return (
    <Layout
      preview={
        until
          ? `You keep ${props.planName} until ${until}.`
          : `${props.planName} won't renew.`
      }
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>Your subscription won't renew</Heading>
      <Text theme={theme}>
        The <Strong theme={theme}>{props.planName}</Strong> plan for{" "}
        <Strong theme={theme}>{props.organizationName}</Strong> has been
        cancelled and won't be charged again.{" "}
        {until ? (
          <>
            Your team keeps access until <Strong theme={theme}>{until}</Strong>,
            then the organization moves to the Free plan.
          </>
        ) : (
          "The organization moves to the Free plan when the current period ends."
        )}
      </Text>
      <Text theme={theme}>Changed your mind? You can resume before then.</Text>
      <Button theme={theme} fallback={false} href={props.resumeUrl} last>
        Resume subscription
      </Button>
    </Layout>
  );
}

SubscriptionCanceled.PreviewProps = {
  organizationName: "Acme Logistics",
  planName: "Pro",
  accessUntil: new Date("2026-11-28T09:12:00Z"),
  resumeUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies SubscriptionCanceledProps;

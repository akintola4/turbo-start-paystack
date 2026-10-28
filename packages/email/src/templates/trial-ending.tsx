import { Layout } from "../components/layout";
import {
  Button,
  DetailTable,
  Heading,
  Strong,
  Text,
} from "../components/primitives";
import { formatDate, formatInterval, formatMoney } from "../format";
import { oneLine } from "../links";
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

export function TrialEnding(props: Themed<TrialEndingProps>) {
  const theme = themeOf(props);
  const amount = formatMoney(props.amountSubunit, props.currency);
  const date = formatDate(props.trialEndsAt);
  return (
    <Layout
      preview={`Your card will be charged ${amount} on ${date}.`}
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>Your trial ends on {date}</Heading>
      <Text theme={theme}>
        The <Strong theme={theme}>{props.planName}</Strong> trial for{" "}
        <Strong theme={theme}>{props.organizationName}</Strong> ends soon.
        Nothing for you to do if you want to keep it: we'll charge the card you
        added when the trial ends.
      </Text>
      <DetailTable
        theme={theme}
        rows={[
          {
            label: "Plan",
            value: `${props.planName} (${formatInterval(props.interval)})`,
          },
          { label: "First charge", value: amount },
          { label: "Charged on", value: date },
        ]}
      />
      <Button theme={theme} fallback={false} href={props.billingUrl}>
        Manage subscription
      </Button>
      <Text theme={theme} muted small style={{ margin: 0 }}>
        To avoid the charge, cancel from the billing page before {date}.
      </Text>
    </Layout>
  );
}

TrialEnding.PreviewProps = {
  organizationName: "Acme Logistics",
  planName: "Starter",
  interval: "monthly",
  trialEndsAt: new Date("2026-10-31T09:00:00Z"),
  amountSubunit: 15_000,
  currency: "GHS",
  billingUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies TrialEndingProps;

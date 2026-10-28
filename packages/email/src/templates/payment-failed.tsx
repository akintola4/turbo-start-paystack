import { Link } from "react-email";

import { Layout } from "../components/layout";
import {
  Button,
  Callout,
  Heading,
  Strong,
  Text,
} from "../components/primitives";
import { formatDate } from "../format";
import { oneLine } from "../links";
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

export function PaymentFailed(props: Themed<PaymentFailedProps>) {
  const theme = themeOf(props);
  const deadline = formatDate(props.graceUntil);
  return (
    <Layout
      preview={`Update your card before ${deadline} to keep ${props.planName}.`}
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>Your payment didn't go through</Heading>
      <Text theme={theme}>
        We couldn't charge the card on file for the{" "}
        <Strong theme={theme}>{props.planName}</Strong> plan for{" "}
        <Strong theme={theme}>{props.organizationName}</Strong>. This usually
        means the card expired, ran out of funds or was declined by the bank.
      </Text>
      <Callout theme={theme}>
        Your team keeps access until <Strong theme={theme}>{deadline}</Strong>.
        After that the subscription is cancelled and the organization moves to
        the Free plan.
      </Callout>
      <Button theme={theme} href={props.manageUrl}>
        Update card
      </Button>
      <Text theme={theme} muted small style={{ margin: 0 }}>
        The link opens Paystack's secure page for this subscription. Once the
        card is updated, Paystack retries the charge. You can also manage
        billing from the{" "}
        <Link
          className="em-muted"
          href={props.billingUrl}
          style={{ color: theme.colors.muted, textDecoration: "underline" }}
        >
          billing page
        </Link>
        .
      </Text>
    </Layout>
  );
}

PaymentFailed.PreviewProps = {
  organizationName: "Acme Logistics",
  planName: "Pro",
  graceUntil: new Date("2026-11-04T09:00:00Z"),
  manageUrl: "https://paystack.com/manage/subscriptions/qlgwhpyq1ts9nsw",
  billingUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies PaymentFailedProps;

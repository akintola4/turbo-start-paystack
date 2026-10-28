import { Layout } from "../components/layout";
import {
  Button,
  DetailTable,
  Heading,
  Strong,
  Text,
} from "../components/primitives";
import { oneLine } from "../links";
import { billingReason, type Themed, themeOf } from "./shared";

export type PaymentDisputedProps = {
  organizationName: string;
  reference: string;
  billingUrl: string;
};

export const paymentDisputedSubject = (p: PaymentDisputedProps) =>
  oneLine(`A payment for ${p.organizationName} was disputed`);

export function PaymentDisputed(props: Themed<PaymentDisputedProps>) {
  const theme = themeOf(props);
  return (
    <Layout
      preview="The card holder's bank opened a dispute on a payment."
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>A payment was disputed</Heading>
      <Text theme={theme}>
        The bank of the card holder for{" "}
        <Strong theme={theme}>{props.organizationName}</Strong> opened a dispute
        (chargeback) on the payment below. Paystack emails the details and the
        deadline for a response.
      </Text>
      <DetailTable
        theme={theme}
        rows={[{ label: "Reference", value: props.reference }]}
      />
      <Button theme={theme} fallback={false} href={props.billingUrl} last>
        View billing
      </Button>
    </Layout>
  );
}

PaymentDisputed.PreviewProps = {
  organizationName: "Acme Logistics",
  reference: "tsp_4f7d2a9c81e64b0f9a3e5c2d7b1a6e90",
  billingUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies PaymentDisputedProps;

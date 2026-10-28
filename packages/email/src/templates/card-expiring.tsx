import { Layout } from "../components/layout";
import { Button, Heading, Strong, Text } from "../components/primitives";
import { oneLine } from "../links";
import { billingReason, type Themed, themeOf } from "./shared";

export type CardExpiringProps = {
  organizationName: string;
  manageUrl: string;
};

export const cardExpiringSubject = (p: CardExpiringProps) =>
  oneLine(`The card for ${p.organizationName} expires soon`);

export function CardExpiring(props: Themed<CardExpiringProps>) {
  const theme = themeOf(props);
  return (
    <Layout
      preview="Update it before the next renewal to avoid a failed payment."
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>Your card expires soon</Heading>
      <Text theme={theme}>
        The card on the subscription for{" "}
        <Strong theme={theme}>{props.organizationName}</Strong> expires before
        the next renewal. Update it now so the payment doesn't fail.
      </Text>
      <Button theme={theme} fallback={false} href={props.manageUrl} last>
        Update card
      </Button>
    </Layout>
  );
}

CardExpiring.PreviewProps = {
  organizationName: "Acme Logistics",
  manageUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies CardExpiringProps;

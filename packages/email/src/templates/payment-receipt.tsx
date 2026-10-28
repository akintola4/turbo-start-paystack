import { Layout } from "../components/layout";
import {
  Button,
  type Detail,
  DetailTable,
  Heading,
  Strong,
  Text,
} from "../components/primitives";
import {
  formatDate,
  formatInterval,
  formatMoney,
  formatShortDate,
} from "../format";
import { oneLine } from "../links";
import { billingReason, type Themed, themeOf } from "./shared";

export type PaymentReceiptProps = {
  organizationName: string;
  planName: string;
  interval: string;
  amountSubunit: number;
  currency: string;
  reference: string;
  paidAt: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  billingUrl: string;
};

export const paymentReceiptSubject = (p: PaymentReceiptProps) =>
  oneLine(
    `Receipt for ${formatMoney(p.amountSubunit, p.currency)}: ${p.organizationName}`
  );

export function PaymentReceipt(props: Themed<PaymentReceiptProps>) {
  const theme = themeOf(props);
  const amount = formatMoney(props.amountSubunit, props.currency);
  const rows: Detail[] = [
    { label: "Amount paid", value: amount },
    {
      label: "Plan",
      value: `${props.planName} (${formatInterval(props.interval)})`,
    },
  ];
  if (props.periodStart && props.periodEnd) {
    rows.push({
      label: "Period",
      value: `${formatShortDate(props.periodStart)} – ${formatShortDate(props.periodEnd)}`,
    });
  }
  rows.push(
    { label: "Paid on", value: formatDate(props.paidAt) },
    { label: "Reference", value: props.reference }
  );
  return (
    <Layout
      preview={`We received ${amount} for ${props.organizationName}. Thank you.`}
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>Payment received</Heading>
      <Text theme={theme}>
        Thanks. We received <Strong theme={theme}>{amount}</Strong> for{" "}
        <Strong theme={theme}>{props.organizationName}</Strong>
        {props.periodEnd
          ? `. Your plan renews on ${formatDate(props.periodEnd)}.`
          : "."}
      </Text>
      <DetailTable theme={theme} rows={rows} />
      <Button theme={theme} fallback={false} href={props.billingUrl}>
        View billing
      </Button>
      <Text theme={theme} muted small style={{ margin: 0 }}>
        Paystack also emails a receipt to the card holder. Keep the reference
        above if you contact support about this payment.
      </Text>
    </Layout>
  );
}

PaymentReceipt.PreviewProps = {
  organizationName: "Acme Logistics",
  planName: "Pro",
  interval: "monthly",
  amountSubunit: 3_000_000,
  currency: "NGN",
  reference: "tsp_4f7d2a9c81e64b0f9a3e5c2d7b1a6e90",
  paidAt: new Date("2026-10-28T09:12:00Z"),
  periodStart: new Date("2026-10-28T09:12:00Z"),
  periodEnd: new Date("2026-11-28T09:12:00Z"),
  billingUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies PaymentReceiptProps;

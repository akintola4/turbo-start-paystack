import { Layout } from "../components/layout";
import {
  Button,
  type Detail,
  DetailTable,
  Heading,
  Strong,
  Text,
} from "../components/primitives";
import { formatDate, formatMoney } from "../format";
import { oneLine } from "../links";
import { billingReason, type Themed, themeOf } from "./shared";

export type PlanChangedProps = {
  organizationName: string;
  change: "upgrade" | "downgrade";
  /** e.g. "Starter (monthly)". */
  fromPlan: string;
  toPlan: string;
  /** Prorated amount charged now (upgrades). 0 when nothing was charged. */
  chargedSubunit: number;
  currency: string;
  /** Now for upgrades; the end of the current period for downgrades. */
  effectiveAt: Date;
  billingUrl: string;
};

export const planChangedSubject = (p: PlanChangedProps) =>
  oneLine(
    p.change === "upgrade"
      ? `${p.organizationName} is now on ${p.toPlan}`
      : `${p.organizationName} moves to ${p.toPlan} on ${formatDate(p.effectiveAt)}`
  );

export function PlanChanged(props: Themed<PlanChangedProps>) {
  const theme = themeOf(props);
  const date = formatDate(props.effectiveAt);
  const upgrade = props.change === "upgrade";
  const rows: Detail[] = [
    { label: "Previous plan", value: props.fromPlan },
    { label: "New plan", value: props.toPlan },
    { label: upgrade ? "Effective" : "Takes effect", value: date },
  ];
  if (upgrade) {
    rows.push({
      label: "Charged now",
      value:
        props.chargedSubunit > 0
          ? formatMoney(props.chargedSubunit, props.currency)
          : "Nothing",
    });
  }
  return (
    <Layout
      preview={
        upgrade
          ? `${props.toPlan} is active now.`
          : `You keep ${props.fromPlan} until ${date}.`
      }
      reason={billingReason(props.organizationName, theme)}
      theme={theme}
    >
      <Heading theme={theme}>
        {upgrade ? "Your plan was upgraded" : "Downgrade scheduled"}
      </Heading>
      {upgrade ? (
        <Text theme={theme}>
          <Strong theme={theme}>{props.organizationName}</Strong> is now on{" "}
          <Strong theme={theme}>{props.toPlan}</Strong>.{" "}
          {props.chargedSubunit > 0
            ? `We charged ${formatMoney(props.chargedSubunit, props.currency)} for the rest of the current billing period. `
            : ""}
          Your billing date doesn't change; the next renewal is at the new
          price.
        </Text>
      ) : (
        <Text theme={theme}>
          <Strong theme={theme}>{props.organizationName}</Strong> keeps{" "}
          <Strong theme={theme}>{props.fromPlan}</Strong> until{" "}
          <Strong theme={theme}>{date}</Strong>, then moves to{" "}
          <Strong theme={theme}>{props.toPlan}</Strong>. The next renewal is
          charged at the new price. Nothing is charged today.
        </Text>
      )}
      <DetailTable theme={theme} rows={rows} />
      <Button theme={theme} fallback={false} href={props.billingUrl} last>
        View billing
      </Button>
    </Layout>
  );
}

PlanChanged.PreviewProps = {
  organizationName: "Acme Logistics",
  change: "upgrade",
  fromPlan: "Starter (monthly)",
  toPlan: "Pro (monthly)",
  chargedSubunit: 1_000_000,
  currency: "NGN",
  effectiveAt: new Date("2026-10-28T09:12:00Z"),
  billingUrl: "https://app.example.com/app/acme/settings/billing",
} satisfies PlanChangedProps;

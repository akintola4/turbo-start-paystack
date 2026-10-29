import { type DetailRow, type EmailContent, money, strong } from "../content";
import { Email } from "../components/email";
import { formatDate, formatMoney } from "../format";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
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

const dayMonth = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);

export function planChangedContent(
  props: PlanChangedProps,
  theme: EmailTheme
): EmailContent {
  const date = formatDate(props.effectiveAt);
  const upgrade = props.change === "upgrade";
  const charged =
    props.chargedSubunit > 0
      ? formatMoney(props.chargedSubunit, props.currency)
      : null;
  const rows: DetailRow[] = [
    { label: "Previous plan", value: props.fromPlan, tile: true },
    { label: "New plan", value: props.toPlan, tile: true },
    {
      label: upgrade ? "Effective" : "Takes effect",
      value: date,
      isHero: !upgrade,
    },
  ];
  if (upgrade) {
    rows.push({
      label: "Charged now",
      value: charged ?? "Nothing",
      money: true,
      isHero: Boolean(charged),
    });
  }
  return {
    billing: true,
    preview: upgrade
      ? `${props.toPlan} is active now.`
      : `You keep ${props.fromPlan} until ${date}.`,
    status: upgrade
      ? { tone: "success", label: "Upgraded", icon: "arrow-up-right" }
      : {
          tone: "quiet",
          label: "Downgrade scheduled",
          icon: "arrow-down-right",
        },
    title: upgrade ? props.toPlan : props.fromPlan,
    headline: upgrade
      ? `You're on ${props.toPlan} now`
      : "Your downgrade is scheduled",
    hero: upgrade
      ? charged
        ? {
            kind: "money",
            amountSubunit: props.chargedSubunit,
            currency: props.currency,
            caption: "Charged today for the rest of this billing period",
          }
        : undefined
      : {
          kind: "date",
          text: `From ${dayMonth(props.effectiveAt)}`,
          caption: `Then ${props.toPlan}. Nothing changes before that.`,
        },
    body: upgrade
      ? [
          [
            strong(props.organizationName),
            ` is on ${props.toPlan} from today.`,
            ...(charged
              ? [
                  " We charged ",
                  money(charged),
                  " to cover the rest of this billing period.",
                ]
              : []),
            " Your renewal date stays the same, at the new price.",
          ],
        ]
      : [
          [
            strong(props.organizationName),
            ` keeps ${props.fromPlan} until `,
            strong(date),
            `, then moves to ${props.toPlan}. Nothing is charged today, and the next renewal is at the new price.`,
          ],
        ],
    details: { title: "Plan change", rows },
    cta: { label: "View billing", href: props.billingUrl },
    reason: billingReason(props.organizationName, theme),
  };
}

export function PlanChanged(props: Themed<PlanChangedProps>) {
  const theme = themeOf(props);
  return <Email content={planChangedContent(props, theme)} theme={theme} />;
}

PlanChanged.PreviewProps = {
  organizationName: "Kola Logistics",
  change: "upgrade",
  fromPlan: "Starter (monthly)",
  toPlan: "Pro (monthly)",
  chargedSubunit: 1_000_000,
  currency: "NGN",
  effectiveAt: new Date("2026-10-28T09:12:00Z"),
  billingUrl: "https://app.example.com/app/kola/settings/billing",
} satisfies PlanChangedProps;

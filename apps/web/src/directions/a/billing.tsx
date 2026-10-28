import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CalendarClockIcon,
  CheckIcon,
  CircleCheckIcon,
  CreditCardIcon,
  HourglassIcon,
  LockIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  BillingAction,
  type BillingConfirm,
} from "@/components/shared/billing-action";
import type { BillingData, PlanOption } from "@/directions/types";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  intervalLabel,
  STATUS_META,
} from "@/lib/format";
import { Banner, Money, PageHeader, Panel, Pill, Section } from "./ui";

function cardLine(card: NonNullable<BillingData["subscription"]>["card"]) {
  if (!card) {
    return "No card on file";
  }
  const brand = card.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : "Card";
  return `${brand} •••• ${card.last4}${card.exp ? `, expires ${card.exp}` : ""}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function planButton(plan: PlanOption, data: BillingData) {
  const sub = data.subscription;
  if (!(plan.price && plan.action)) {
    return null;
  }
  const per = intervalLabel(plan.price.interval, "long");
  let label = `Choose ${plan.name}`;
  let confirm: BillingConfirm | undefined;
  if (plan.action === "checkout") {
    label =
      plan.trialDays > 0
        ? `Start ${plan.trialDays}-day trial`
        : `Choose ${plan.name}`;
  } else if (plan.change === "upgrade") {
    label = `Upgrade to ${plan.name}`;
    confirm = {
      title: `Upgrade to ${plan.name}?`,
      description:
        sub?.status === "trialing"
          ? `You move to ${plan.name} now. Nothing is charged during the trial; ${plan.price.label} a ${per} starts when it ends.`
          : `You're charged the prorated difference for the rest of this period today, then ${plan.price.label} a ${per} from ${formatDate(sub?.currentPeriodEnd)}.`,
      confirmLabel: `Upgrade to ${plan.name}`,
      cancelLabel: "Not now",
    };
  } else if (plan.change === "downgrade") {
    label = `Switch to ${plan.name}`;
    confirm = {
      title: `Switch to ${plan.name} at the end of this period?`,
      description: `You keep ${sub?.planName ?? "your plan"} until ${formatDate(sub?.currentPeriodEnd)}. ${plan.name} starts then at ${plan.price.label} a ${per}.`,
      confirmLabel: `Schedule switch`,
      cancelLabel: "Keep current plan",
    };
  } else {
    label =
      plan.price.interval === "annually"
        ? "Switch to yearly"
        : "Switch to monthly";
    confirm = {
      title: label,
      description: `Billing moves to ${plan.price.label} a ${per}. The difference for the rest of this period is prorated.`,
      confirmLabel: label,
      cancelLabel: "Not now",
    };
  }
  return (
    <BillingAction
      action={plan.action}
      className="w-full"
      confirm={confirm}
      disabled={!data.canManage}
      orgId={data.org.id}
      planPriceId={plan.price.id}
      publicKey={data.publicKey}
      variant={plan.change === "downgrade" ? "outline" : "default"}
    >
      {label}
    </BillingAction>
  );
}

function IntervalSwitch({ data }: { data: BillingData }) {
  const saving = data.plans.find((p) => p.saving)?.saving;
  const options = [
    { key: "monthly", label: "Monthly", href: data.hrefs.monthly },
    { key: "annually", label: "Yearly", href: data.hrefs.annually },
  ] as const;
  return (
    <div className="flex items-center gap-3">
      <nav
        aria-label="Billing interval"
        className="inline-flex h-8 items-center rounded-md border bg-muted p-0.5"
      >
        {options.map((o) => {
          const active = data.interval === o.key;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-[5px] px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.08)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              href={o.href}
              key={o.key}
              scroll={false}
            >
              {o.label}
            </Link>
          );
        })}
      </nav>
      {data.interval === "annually" && saving ? (
        <span className="text-(--ledger-pos-ink) text-sm">
          {saving} on yearly
        </span>
      ) : (
        <span className="hidden text-muted-foreground text-sm sm:inline">
          Yearly saves about two months
        </span>
      )}
    </div>
  );
}

export function LedgerBilling({ data }: { data: BillingData }) {
  const sub = data.subscription;
  const status = sub ? STATUS_META[sub.status] : STATUS_META.free;
  const trialDays =
    sub?.status === "trialing" ? daysUntil(sub.trialEndsAt) : null;

  return (
    <div className="grid gap-10">
      <PageHeader
        description={`Plan, payment method and invoices for ${data.org.name}. Prices in ${data.currency}.`}
        title="Billing"
      />

      <div className="grid gap-3 empty:hidden">
        {data.payment === "succeeded" ? (
          <Banner
            icon={<CircleCheckIcon />}
            title="Payment confirmed"
            tone="positive"
          >
            Paystack confirmed the payment and your plan is up to date.
          </Banner>
        ) : data.payment === "created" ? (
          <Banner
            icon={<HourglassIcon />}
            title="Waiting for Paystack"
            tone="info"
          >
            We haven't received confirmation yet. Refresh in a moment.
          </Banner>
        ) : null}
        {sub?.status === "past_due" ? (
          <Banner
            action={
              data.canManage ? (
                <BillingAction
                  action="manage-card"
                  orgId={data.org.id}
                  size="sm"
                  variant="outline"
                >
                  Update card
                </BillingAction>
              ) : null
            }
            icon={<TriangleAlertIcon />}
            title="Your last payment failed"
            tone="warning"
          >
            Update your card before {formatDate(sub.graceUntil)} to keep access.
            Paid features stay on until then.
          </Banner>
        ) : null}
        {sub?.status === "trialing" ? (
          <Banner
            icon={<CalendarClockIcon />}
            title={
              trialDays !== null && trialDays >= 0
                ? `${trialDays} days left in your trial`
                : "Your trial is ending"
            }
            tone="info"
          >
            We'll charge {sub.priceLabel} to{" "}
            {sub.card ? `the card ending ${sub.card.last4}` : "your card"} on{" "}
            {formatDate(sub.trialEndsAt)}. Cancel before then and you won't be
            charged.
          </Banner>
        ) : null}
        {sub && (sub.cancelAtPeriodEnd || sub.status === "non_renewing") ? (
          <Banner
            action={
              data.canManage ? (
                <BillingAction
                  action="resume"
                  orgId={data.org.id}
                  size="sm"
                  variant="outline"
                >
                  Resume subscription
                </BillingAction>
              ) : null
            }
            icon={<CalendarClockIcon />}
            title={`Your subscription ends on ${formatDate(sub.currentPeriodEnd)}`}
            tone="info"
          >
            You keep {sub.planName} until then, and move to Free after.
          </Banner>
        ) : null}
      </div>

      <Section
        action={
          sub && data.canManage ? (
            <div className="flex items-center gap-2">
              {sub.status === "past_due" ? null : (
                <BillingAction
                  action="manage-card"
                  orgId={data.org.id}
                  size="sm"
                  variant="outline"
                >
                  <CreditCardIcon />
                  Update card
                </BillingAction>
              )}
              {sub.status === "non_renewing" || sub.cancelAtPeriodEnd ? null : (
                <BillingAction
                  action="cancel"
                  confirm={{
                    title: "Cancel the subscription?",
                    description: `${data.org.name} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}, then moves to Free. You can resume any time before then.`,
                    confirmLabel: "Cancel subscription",
                    cancelLabel: "Keep subscription",
                    destructive: true,
                  }}
                  orgId={data.org.id}
                  className="-mr-3"
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </BillingAction>
              )}
            </div>
          ) : null
        }
        title="Current plan"
      >
        <Panel>
          <dl className="divide-y">
            <Row label="Plan">
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {sub?.planName ?? data.entitlement.planName}
                </span>
                <Pill tone={status.tone}>
                  <span data-testid="subscription-status">{status.label}</span>
                </Pill>
              </span>
            </Row>
            <Row label="Price">
              {sub ? (
                <span>
                  <Money label={sub.priceLabel} quiet={false} />
                  <span className="text-muted-foreground">
                    {" "}
                    a {intervalLabel(sub.interval, "long")}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">No charge</span>
              )}
            </Row>
            {sub ? (
              <Row
                label={
                  sub.status === "trialing"
                    ? "Trial ends"
                    : sub.cancelAtPeriodEnd || sub.status === "non_renewing"
                      ? "Access ends"
                      : sub.status === "past_due"
                        ? "Access until"
                        : "Renews"
                }
              >
                <span className="tabular-nums">
                  {formatDate(
                    sub.status === "trialing"
                      ? sub.trialEndsAt
                      : sub.status === "past_due"
                        ? sub.graceUntil
                        : sub.currentPeriodEnd
                  )}
                </span>
              </Row>
            ) : null}
            {sub ? (
              <Row label="Payment method">
                <span className="inline-flex items-center gap-2">
                  <CreditCardIcon
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                  {cardLine(sub.card)}
                </span>
              </Row>
            ) : null}
            {sub?.scheduled ? (
              <Row label="Scheduled change">
                Moves to {sub.scheduled.planName} ({sub.scheduled.interval}) on{" "}
                {formatDate(sub.currentPeriodEnd)}
              </Row>
            ) : null}
          </dl>
        </Panel>
      </Section>

      <Section action={<IntervalSwitch data={data} />} title="Plans">
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {data.plans.map((plan) => (
            <div
              className={cn(
                "relative flex flex-col gap-5 bg-card p-6",
                plan.isCurrent &&
                  "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-(--ledger-accent)"
              )}
              key={plan.key}
            >
              <div className="grid gap-1">
                <div className="flex h-6 items-center justify-between gap-2">
                  <h3 className="font-semibold text-[15px]">{plan.name}</h3>
                  {plan.isCurrent ? (
                    <Pill tone="info">Current plan</Pill>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>
              <div className="flex h-10 items-baseline gap-1.5">
                {plan.price ? (
                  <>
                    <Money
                      className="font-semibold text-3xl tracking-tight"
                      label={plan.price.label.replace(/\.00$/, "")}
                      quiet={false}
                    />
                    <span className="text-muted-foreground text-sm">
                      / {intervalLabel(plan.price.interval, "long")}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-3xl tracking-tight">
                    Free
                  </span>
                )}
                {plan.saving ? (
                  <span className="ml-auto text-(--ledger-pos-ink) text-xs">
                    {plan.saving}
                  </span>
                ) : null}
              </div>
              <div className="min-h-9">
                {plan.isCurrent ? (
                  <p className="flex h-9 items-center text-muted-foreground text-sm">
                    You're on this plan.
                  </p>
                ) : plan.action ? (
                  planButton(plan, data)
                ) : (
                  <p className="flex h-9 items-center text-muted-foreground text-sm">
                    Cancel to return to Free.
                  </p>
                )}
              </div>
              <ul className="grid gap-2.5 border-t pt-5 text-sm">
                {plan.features.map((f) => (
                  <li className="flex gap-2.5" key={f}>
                    <CheckIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-(--ledger-accent)"
                    />
                    {f}
                  </li>
                ))}
                {plan.trialDays > 0 ? (
                  <li className="flex gap-2.5 text-muted-foreground">
                    <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {plan.trialDays}-day trial, card required
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
        {data.canManage ? null : (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <LockIcon aria-hidden className="size-4" />
            Only owners and billing managers can change the plan.
          </p>
        )}
      </Section>

      <Section title="Invoices">
        <Panel>
          {data.invoices.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-6 py-12 text-center">
              <ReceiptTextIcon
                aria-hidden
                className="size-5 text-muted-foreground"
              />
              <p className="font-medium text-sm">No invoices yet</p>
              <p className="text-muted-foreground text-sm">
                Paystack sends a receipt for every charge, and it shows up here
                too.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-36 pl-5 text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="hidden h-10 text-muted-foreground sm:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="h-10 w-36 text-right text-muted-foreground">
                    Amount
                  </TableHead>
                  <TableHead className="h-10 w-32 pr-5 text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((inv) => {
                  const meta = INVOICE_META[inv.status] ?? {
                    label: inv.status,
                    tone: "neutral" as const,
                  };
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="h-12 whitespace-nowrap pl-5 tabular-nums">
                        {formatDate(inv.date)}
                      </TableCell>
                      <TableCell className="hidden max-w-0 truncate text-muted-foreground sm:table-cell">
                        {inv.description}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Money label={inv.amountLabel} />
                      </TableCell>
                      <TableCell className="pr-5">
                        <Pill tone={meta.tone}>{meta.label}</Pill>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>
    </div>
  );
}

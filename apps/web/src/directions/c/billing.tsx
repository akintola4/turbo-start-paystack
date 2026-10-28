import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  ReceiptIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  BillingAction,
  type BillingConfirm,
} from "@/components/shared/billing-action";
import type {
  BillingData,
  PlanOption,
  SubscriptionSummary,
} from "@/directions/types";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  intervalLabel,
  STATUS_META,
} from "@/lib/format";
import { Chip, HighlightChip, Money, PageHeader, Tile, glyphMoney } from "./ui";

function Notice({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: "warning" | "positive" | "info";
  icon: typeof AlertTriangleIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const styles = {
    warning:
      "border-[var(--c-warn-border)] bg-[var(--c-warn-surface)] [--ink:var(--c-warn-ink)]",
    positive: "border-primary/30 bg-primary/[0.06] [--ink:var(--primary)]",
    info: "border-border bg-card [--ink:var(--muted-foreground)]",
  } as const;
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border p-5 sm:flex-row sm:items-center sm:justify-between",
        styles[tone]
      )}
      role={tone === "warning" ? "alert" : "status"}
    >
      <div className="flex gap-3">
        <Icon
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-[var(--ink)]"
        />
        <div className="grid gap-1">
          <p className="font-display font-semibold">{title}</p>
          {children ? (
            <div className="text-muted-foreground text-sm">{children}</div>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[var(--c-hero-muted)] text-sm">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function CurrentPlan({ data }: { data: BillingData }) {
  const sub = data.subscription;
  const heroButton =
    "h-10 rounded-full bg-white px-5 text-[oklch(0.3_0.08_163)] hover:bg-white/90 dark:bg-white dark:text-[oklch(0.3_0.08_163)]";
  const ghostButton =
    "h-10 rounded-full border-white/30 bg-transparent px-5 text-[var(--c-hero-foreground)] hover:bg-white/10 hover:text-[var(--c-hero-foreground)] dark:border-white/30 dark:bg-transparent dark:hover:bg-white/10";

  if (!sub) {
    return (
      <Tile className="grid gap-6 border-0 bg-[var(--c-hero)] text-[var(--c-hero-foreground)] sm:p-8">
        <div className="grid gap-2">
          <p className="text-[var(--c-hero-muted)] text-sm">Current plan</p>
          <p className="font-display font-semibold text-[44px] leading-none tracking-tight">
            Free
          </p>
          <p className="max-w-[48ch] text-[var(--c-hero-muted)]">
            Up to 3 members. Pick a paid plan below; it starts with a 14-day
            trial and a small refundable card check.
          </p>
        </div>
      </Tile>
    );
  }

  const status = STATUS_META[sub.status];
  const isTrial = sub.status === "trialing";
  const nextDate = isTrial ? sub.trialEndsAt : sub.currentPeriodEnd;
  const days = daysUntil(nextDate);
  const cancelConfirm: BillingConfirm = {
    title: "Cancel at the end of this period?",
    description: `${data.org.name} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}. After that it moves to the Free plan. You can resume any time before then.`,
    confirmLabel: "Cancel subscription",
    cancelLabel: "Keep subscription",
    destructive: true,
  };

  return (
    <Tile className="grid gap-8 border-0 bg-[var(--c-hero)] text-[var(--c-hero-foreground)] sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display font-semibold text-2xl tracking-tight">
              {sub.planName}
            </h2>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white/15 px-2.5 font-medium text-xs">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {status.label}
            </span>
          </div>
          <Money
            label={sub.priceLabel}
            per={intervalLabel(sub.interval, "long")}
            size="xl"
          />
        </div>
        {data.canManage ? (
          <div className="flex flex-wrap gap-2">
            <BillingAction
              action="manage-card"
              className={heroButton}
              orgId={data.org.id}
            >
              <CreditCardIcon aria-hidden />
              Update card
            </BillingAction>
            {sub.status === "non_renewing" || sub.cancelAtPeriodEnd ? (
              <BillingAction
                action="resume"
                className={ghostButton}
                orgId={data.org.id}
                variant="outline"
              >
                Resume
              </BillingAction>
            ) : sub.status !== "past_due" ? (
              <BillingAction
                action="cancel"
                className={ghostButton}
                confirm={cancelConfirm}
                orgId={data.org.id}
                variant="outline"
              >
                Cancel plan
              </BillingAction>
            ) : null}
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-white/15 border-t pt-6 sm:grid-cols-4">
        <Fact
          label={
            sub.cancelAtPeriodEnd
              ? "Access ends"
              : isTrial
                ? "Trial ends"
                : sub.status === "past_due"
                  ? "Was due"
                  : "Renews"
          }
        >
          {formatDate(nextDate)}
        </Fact>
        <Fact label={isTrial ? "First charge" : "Next charge"}>
          {sub.cancelAtPeriodEnd
            ? "None"
            : days !== null && days >= 0
              ? `In ${days} days`
              : "Due now"}
        </Fact>
        <Fact label="Card">
          {sub.card ? (
            <span className="capitalize">
              {sub.card.brand ?? "Card"} •••• {sub.card.last4}
            </span>
          ) : (
            "None on file"
          )}
        </Fact>
        <Fact label="Currency">{sub.currency}</Fact>
      </dl>
      {sub.scheduled ? (
        <p className="rounded-[14px] bg-white/10 px-4 py-3 text-sm">
          Switches to {sub.scheduled.planName} ({sub.scheduled.interval}) on{" "}
          {formatDate(sub.currentPeriodEnd)}.
        </p>
      ) : null}
    </Tile>
  );
}

function planConfirm(
  plan: PlanOption,
  sub: SubscriptionSummary | null,
  orgName: string
): BillingConfirm | undefined {
  if (!(plan.action === "change-plan" && plan.price && sub)) {
    return undefined;
  }
  if (plan.change === "upgrade") {
    return {
      title: `Upgrade to ${plan.name}?`,
      description:
        sub.status === "trialing"
          ? `${orgName} moves to ${plan.name} straight away. You're still in your trial, so nothing is charged today.`
          : `${orgName} moves to ${plan.name} straight away. We charge the difference for the rest of this period to the card on file, then ${glyphMoney(plan.price.label)} per ${intervalLabel(plan.price.interval, "long")}.`,
      confirmLabel: `Upgrade to ${plan.name}`,
      cancelLabel: "Not now",
    };
  }
  return {
    title: `Switch to ${plan.name}?`,
    description: `${orgName} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}, then moves to ${plan.name} at ${glyphMoney(plan.price.label)} per ${intervalLabel(plan.price.interval, "long")}. Nothing is charged today.`,
    confirmLabel: `Switch to ${plan.name}`,
    cancelLabel: "Not now",
  };
}

function PlanTiles({ data }: { data: BillingData }) {
  const sub = data.subscription;
  const blocked =
    sub &&
    (sub.status === "past_due" ||
      sub.status === "non_renewing" ||
      sub.cancelAtPeriodEnd);
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {data.plans.map((plan) => {
        const label =
          plan.action === "checkout"
            ? plan.trialDays
              ? `Start ${plan.trialDays}-day trial`
              : `Choose ${plan.name}`
            : plan.change === "upgrade"
              ? `Upgrade to ${plan.name}`
              : `Switch to ${plan.name}`;
        return (
          <li
            className={cn(
              "relative flex flex-col gap-5 rounded-[20px] border bg-card p-6 shadow-[var(--c-shadow)]",
              plan.isCurrent &&
                "border-[var(--c-highlight)] ring-2 ring-[var(--c-highlight)]"
            )}
            key={plan.key}
          >
            <div className="flex min-h-6 items-center justify-between gap-2">
              <h3 className="font-display font-semibold text-lg">
                {plan.name}
              </h3>
              {plan.isCurrent ? (
                <HighlightChip>Current plan</HighlightChip>
              ) : plan.saving ? (
                <Chip dot={false} tone="positive">
                  {plan.saving}
                </Chip>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              {plan.price ? (
                <Money
                  label={plan.price.label}
                  per={intervalLabel(plan.price.interval, "long")}
                />
              ) : (
                <span className="font-display font-semibold text-[32px] leading-none tracking-tight">
                  Free
                </span>
              )}
              <p className="text-muted-foreground text-sm">
                {plan.description}
              </p>
            </div>
            <ul className="grid gap-2 border-t pt-5 text-sm">
              {plan.features.map((f) => (
                <li className="flex items-center gap-2" key={f}>
                  <CheckIcon
                    aria-hidden
                    className="size-4 shrink-0 text-primary"
                  />
                  {f}
                </li>
              ))}
              {plan.trialDays > 0 && !sub ? (
                <li className="flex items-center gap-2">
                  <CheckIcon
                    aria-hidden
                    className="size-4 shrink-0 text-primary"
                  />
                  {plan.trialDays}-day trial, card required
                </li>
              ) : null}
            </ul>
            <div className="mt-auto">
              {plan.action && plan.price ? (
                <BillingAction
                  action={plan.action}
                  className="h-10 w-full rounded-full"
                  confirm={planConfirm(plan, sub, data.org.name)}
                  disabled={!data.canManage || Boolean(blocked)}
                  orgId={data.org.id}
                  planPriceId={plan.price.id}
                  publicKey={data.publicKey}
                  variant={plan.change === "downgrade" ? "outline" : "default"}
                >
                  {label}
                </BillingAction>
              ) : plan.isCurrent ? (
                <p className="flex h-10 items-center justify-center gap-2 rounded-full bg-muted font-medium text-muted-foreground text-sm">
                  <CheckCircle2Icon aria-hidden className="size-4" />
                  You're on this plan
                </p>
              ) : (
                <p className="flex h-10 items-center justify-center rounded-full border border-dashed text-muted-foreground text-sm">
                  Cancel your plan to move to Free
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IntervalSwitch({ data }: { data: BillingData }) {
  const annualSaving = data.plans.find((p) => p.key === "pro")?.saving;
  const item = (key: "monthly" | "annually", text: string) => {
    const active = data.interval === key;
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full px-4 font-medium text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
          active
            ? "bg-background text-foreground shadow-[var(--c-shadow)]"
            : "text-muted-foreground hover:text-foreground"
        )}
        href={data.hrefs[key]}
        scroll={false}
      >
        {text}
      </Link>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav
        aria-label="Billing interval"
        className="flex rounded-full bg-muted p-1"
      >
        {item("monthly", "Monthly")}
        {item("annually", "Annually")}
      </nav>
      {data.interval === "monthly" ? (
        <span className="text-muted-foreground text-sm">
          Pay yearly and save about 17%
        </span>
      ) : annualSaving ? (
        <HighlightChip>{annualSaving}</HighlightChip>
      ) : null}
    </div>
  );
}

export function Billing({ data }: { data: BillingData }) {
  const sub = data.subscription;
  return (
    <div className="grid gap-8">
      <PageHeader
        description={`Plan, card and invoices for ${data.org.name}. Prices are in ${data.currency}.`}
        title="Billing"
      />

      {data.payment === "succeeded" ? (
        <Notice
          icon={CheckCircle2Icon}
          title="Payment confirmed"
          tone="positive"
        >
          Paystack confirmed the payment and your plan is updated.
        </Notice>
      ) : data.payment === "created" ? (
        <Notice icon={ClockIcon} title="Waiting for Paystack" tone="info">
          We haven't received confirmation yet. Refresh in a moment.
        </Notice>
      ) : null}

      {sub?.status === "past_due" ? (
        <Notice
          action={
            data.canManage ? (
              <BillingAction
                action="manage-card"
                className="h-10 shrink-0 rounded-full px-5"
                orgId={data.org.id}
              >
                <CreditCardIcon aria-hidden />
                Update card
              </BillingAction>
            ) : null
          }
          icon={AlertTriangleIcon}
          title="Your last payment failed"
          tone="warning"
        >
          Update your card before {formatDate(sub.graceUntil)} to keep access.
          Plan changes are paused until then.
        </Notice>
      ) : null}

      <CurrentPlan data={data} />

      <section aria-labelledby="plans-title" className="grid gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <h2
              className="font-display font-semibold text-2xl tracking-tight"
              id="plans-title"
            >
              Plans
            </h2>
            <p className="text-muted-foreground text-sm">
              Upgrades apply now and are prorated. Downgrades apply at the end
              of the period.
            </p>
          </div>
          <IntervalSwitch data={data} />
        </div>
        <PlanTiles data={data} />
        {data.canManage ? null : (
          <p className="text-muted-foreground text-sm">
            Only owners and billing managers can change the plan.
          </p>
        )}
      </section>

      <section
        aria-labelledby="invoices-title"
        className="grid scroll-mt-8 gap-5"
        id="invoices"
      >
        <h2
          className="font-display font-semibold text-2xl tracking-tight"
          id="invoices-title"
        >
          Invoices
        </h2>
        <Tile className="p-2 sm:p-3">
          {data.invoices.length ? (
            <ul className="grid divide-y">
              {data.invoices.map((inv) => {
                const meta = INVOICE_META[inv.status] ?? {
                  label: inv.status,
                  tone: "neutral" as const,
                };
                return (
                  <li
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-3 py-3.5 sm:grid-cols-[auto_8rem_1fr_auto_6.5rem]"
                    key={inv.id}
                  >
                    <span className="row-span-2 flex size-10 items-center justify-center rounded-[12px] bg-muted text-muted-foreground sm:row-span-1">
                      <ReceiptIcon aria-hidden className="size-[18px]" />
                    </span>
                    <span className="order-2 col-start-2 text-muted-foreground text-sm tabular-nums sm:order-none sm:col-start-auto">
                      {formatDate(inv.date)}
                    </span>
                    <span className="min-w-0 truncate font-medium text-sm">
                      {inv.description}
                    </span>
                    <span className="text-right font-display font-semibold tabular-nums">
                      {glyphMoney(inv.amountLabel)}
                    </span>
                    <span className="order-3 justify-self-end sm:order-none">
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid justify-items-start gap-2 p-5">
              <p className="font-medium">No invoices yet</p>
              <p className="text-muted-foreground text-sm">
                Receipts show up here after the first charge.
              </p>
            </div>
          )}
        </Tile>
        {sub ? null : (
          <Button asChild className="w-fit rounded-full" variant="outline">
            <Link href="#plans-title">Compare plans</Link>
          </Button>
        )}
      </section>
    </div>
  );
}

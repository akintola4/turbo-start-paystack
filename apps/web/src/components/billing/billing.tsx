import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  ReceiptIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  BillingAction,
  type BillingConfirm,
} from "@/components/billing/billing-action";
import { PlanPicker } from "@/components/billing/plan-picker";
import { SwapOnChange } from "@/components/motion";
import type { BillingData } from "@/lib/view-models";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  intervalLabel,
  STATUS_META,
} from "@/lib/format";
import {
  CardNumber,
  Chip,
  Money,
  PageHeader,
  Tile,
} from "@/components/primitives";

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
    warning: "border-tone-warning-border bg-tone-warning",
    positive: "border-primary/30 bg-tone-positive",
    info: "border-border bg-card",
  } as const;
  const ink = {
    warning: "text-tone-warning-foreground",
    positive: "text-tone-positive-foreground",
    info: "text-muted-foreground",
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
        <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", ink[tone])} />
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
      <dt className="text-hero-muted text-sm">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function CurrentPlan({ data }: { data: BillingData }) {
  const sub = data.subscription;
  const heroButton =
    "h-10 rounded-full bg-hero-action px-5 text-hero-action-foreground hover:bg-hero-action/90";
  const ghostButton =
    "h-10 rounded-full border-hero-foreground/30 bg-transparent px-5 text-hero-foreground hover:bg-hero-tile hover:text-hero-foreground dark:border-hero-foreground/30 dark:bg-transparent dark:hover:bg-hero-tile";

  if (!sub) {
    return (
      <Tile className="grid gap-6 border-0 bg-hero text-hero-foreground sm:p-8">
        <div className="grid gap-2">
          <p className="text-hero-muted text-sm">Current plan</p>
          <p className="font-display font-semibold text-[44px] leading-none tracking-tight">
            Free
          </p>
          <p className="max-w-[48ch] text-hero-muted">
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
    <Tile className="grid gap-8 border-0 bg-hero text-hero-foreground sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SwapOnChange value={sub.planName}>
              <h2 className="font-display font-semibold text-2xl tracking-tight">
                {sub.planName}
              </h2>
            </SwapOnChange>
            <SwapOnChange value={sub.status}>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-hero-tile px-2.5 font-medium text-xs">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-current"
                />
                {status.label}
              </span>
            </SwapOnChange>
          </div>
          <SwapOnChange value={`${sub.priceLabel}/${sub.interval}`}>
            <Money
              label={sub.priceLabel}
              per={intervalLabel(sub.interval, "long")}
              size="xl"
            />
          </SwapOnChange>
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
            <CardNumber brand={sub.card.brand} last4={sub.card.last4} />
          ) : (
            "None on file"
          )}
        </Fact>
        <Fact label="Currency">{sub.currency}</Fact>
      </dl>
      {sub.scheduled ? (
        <p className="rounded-[14px] bg-hero-tile px-4 py-3 text-sm">
          Switches to {sub.scheduled.planName} ({sub.scheduled.interval}) on{" "}
          {formatDate(sub.currentPeriodEnd)}.
        </p>
      ) : null}
    </Tile>
  );
}

export function Billing({ data }: { data: BillingData }) {
  const sub = data.subscription;
  return (
    <div className="grid animate-content gap-8">
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
        <PlanPicker
          data={data}
          heading={
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
          }
        />
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
                      {inv.amountLabel}
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
          <Link
            className={buttonVariants({
              variant: "outline",
              className: "w-fit rounded-full",
            })}
            href="#plans-title"
          >
            Compare plans
          </Link>
        )}
      </section>
    </div>
  );
}

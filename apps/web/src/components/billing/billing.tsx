import {
  CalendarIcon,
  CreditCardIcon,
  type LucideIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import {
  BillingAction,
  type BillingConfirm,
} from "@/components/billing/billing-action";
import { BillingDetails } from "@/components/billing/billing-details";
import { DevBillingPanel } from "@/components/billing/dev-billing-panel";
import { InvoiceList } from "@/components/billing/invoice-list";
import { PaymentToast } from "@/components/billing/payment-toast";
import { PlanPicker } from "@/components/billing/plan-picker";
import { SwapOnChange } from "@/components/motion";
import {
  Amount,
  CardNumber,
  Money,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/primitives";
import { daysUntil, formatDate, intervalLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { BillingData, SubscriptionSummary } from "@/lib/view-models";

/** One meta well on the money panel: icon, label, value. */
function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 rounded-card bg-panel-tile px-4 py-3.5 max-sm:rounded-none max-sm:bg-transparent max-sm:px-0 max-sm:py-3">
      <dt className="flex items-center gap-1.5 font-medium text-[13px] text-panel-muted">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </dt>
      <dd className="font-semibold text-[15px] tabular-nums">{children}</dd>
    </div>
  );
}

function daysPhrase(days: number | null) {
  if (days === null || days < 0) {
    return "";
  }
  if (days === 0) {
    return " (today)";
  }
  return ` (in ${days} ${days === 1 ? "day" : "days"})`;
}

/** The single most important line: what is charged next, when. */
function nextCharge(sub: SubscriptionSummary) {
  if (sub.cancelAtPeriodEnd || sub.status === "non_renewing") {
    return {
      label: "Access ends",
      value: formatDate(sub.currentPeriodEnd),
    };
  }
  if (sub.status === "past_due") {
    return {
      label: "Payment failed",
      value: `Update card before ${formatDate(sub.graceUntil)}`,
    };
  }
  const when =
    sub.status === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd;
  return {
    label: sub.status === "trialing" ? "First charge" : "Next charge",
    value: (
      <>
        <Amount label={sub.priceLabel} /> on {formatDate(when, "short")}
        <span className="font-normal text-panel-muted">
          {daysPhrase(daysUntil(when))}
        </span>
      </>
    ),
  };
}

function CurrentPlan({ data }: { data: BillingData }) {
  const sub = data.subscription;

  if (!sub) {
    return (
      <Panel className="grid gap-6">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-xl">Free plan</h2>
          <StatusBadge status="free" />
        </div>
        <Money label={formatMoney(0, data.currency)} per="month" size="xl" />
        <p className="max-w-[52ch] text-panel-muted">
          Up to {data.seats.limit} members. Paid plans start with a 14-day
          trial; we check the card with a small charge that is refunded straight
          away.
        </p>
      </Panel>
    );
  }

  const grace = daysUntil(sub.graceUntil);
  const trialDays = daysUntil(sub.trialEndsAt);
  const charge = nextCharge(sub);
  const cancelConfirm: BillingConfirm = {
    title: "Cancel at the end of this period?",
    description: `${data.org.name} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}, then moves to the Free plan (up to 3 members). You can resume any time before then.`,
    confirmLabel: "Cancel plan",
    cancelLabel: `Keep ${sub.planName}`,
    destructive: true,
  };

  return (
    <div className="grid gap-3">
      <Panel aria-labelledby="current-plan" className="grid gap-6 sm:gap-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SwapOnChange value={sub.planName}>
                <h2 className="font-semibold text-xl" id="current-plan">
                  {sub.planName} plan
                </h2>
              </SwapOnChange>
              <span aria-live="polite">
                <SwapOnChange value={sub.status}>
                  <StatusBadge
                    graceEnded={grace !== null && grace < 0}
                    label={
                      sub.status === "trialing" && trialDays !== null
                        ? `Trial, ${Math.max(trialDays, 0)} days left`
                        : undefined
                    }
                    status={sub.status}
                  />
                </SwapOnChange>
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
              {sub.status === "non_renewing" || sub.cancelAtPeriodEnd ? (
                <BillingAction
                  action="resume"
                  orgId={data.org.id}
                  successMessage={`${sub.planName} resumed`}
                >
                  Resume {sub.planName}
                </BillingAction>
              ) : (
                <BillingAction
                  action="manage-card"
                  orgId={data.org.id}
                  variant={sub.status === "past_due" ? "default" : "outline"}
                >
                  <CreditCardIcon aria-hidden />
                  Update card
                </BillingAction>
              )}
            </div>
          ) : null}
        </div>
        <dl className="grid gap-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-panel-line max-sm:rounded-card max-sm:bg-panel-tile max-sm:px-4 sm:grid-cols-3">
          <Meta icon={CalendarIcon} label={charge.label}>
            {charge.value}
          </Meta>
          <Meta icon={CreditCardIcon} label="Card">
            {sub.card ? (
              <CardNumber brand={sub.card.brand} last4={sub.card.last4} />
            ) : (
              "None on file"
            )}
          </Meta>
          <Meta icon={UsersIcon} label="Seats">
            <AnimatedNumber value={data.seats.used} /> of {data.seats.limit}
          </Meta>
        </dl>
        {sub.scheduled ? (
          <p className="text-panel-muted text-sm">
            Moves to {sub.scheduled.planName} (
            {intervalLabel(sub.scheduled.interval, "long")}ly) on{" "}
            {formatDate(sub.currentPeriodEnd)}.
          </p>
        ) : null}
      </Panel>
      {data.canManage &&
      sub.status !== "non_renewing" &&
      !sub.cancelAtPeriodEnd &&
      sub.status !== "past_due" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-muted-foreground text-sm">
            Cancelling keeps {sub.planName} until{" "}
            {formatDate(sub.currentPeriodEnd)}.
          </p>
          <BillingAction
            action="cancel"
            confirm={cancelConfirm}
            orgId={data.org.id}
            size="sm"
            successMessage={`${sub.planName} ends on ${formatDate(sub.currentPeriodEnd)}`}
            variant="ghost"
          >
            Cancel plan
          </BillingAction>
        </div>
      ) : null}
    </div>
  );
}

function PastDueBanner({ data }: { data: BillingData }) {
  const sub = data.subscription;
  if (sub?.status !== "past_due") {
    return null;
  }
  const deadline = formatDate(sub.graceUntil);
  return (
    <>
      <div
        className="flex items-start gap-3 rounded-tile bg-warning-bg p-4 text-warning sm:p-5"
        role="alert"
      >
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="grid gap-1 text-foreground">
          <p className="font-semibold">Payment failed</p>
          <p className="text-muted-foreground">
            Update the card before {deadline} to keep {sub.planName}. Plan
            changes are paused until the payment goes through.
          </p>
        </div>
      </div>
      {data.canManage ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-tile sm:hidden">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Payment failed.</span>{" "}
            <span className="text-muted-foreground">Fix by {deadline}</span>
          </p>
          <BillingAction action="manage-card" orgId={data.org.id}>
            Update card
          </BillingAction>
        </div>
      ) : null}
    </>
  );
}

export function Billing({ data }: { data: BillingData }) {
  const sub = data.subscription;
  const description = sub
    ? `${sub.planName}, ${intervalLabel(sub.interval, "long")}ly billing in ${data.currency}`
    : `Free plan, prices in ${data.currency}`;
  return (
    <div className="grid animate-content gap-10 pb-24 sm:gap-12 sm:pb-0">
      <PaymentToast payment={data.payment} status={sub?.status ?? null} />
      <PageHeader description={description} title="Billing" />
      <PastDueBanner data={data} />
      <CurrentPlan data={data} />
      {data.devTools ? (
        <DevBillingPanel orgId={data.org.id} status={sub?.status ?? null} />
      ) : null}
      <section aria-labelledby="plans-title" className="grid gap-5">
        <PlanPicker
          data={data}
          heading={
            <div className="grid gap-1">
              <h2 className="font-semibold text-xl" id="plans-title">
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
      <div className="grid gap-4">
        <InvoiceList data={data} />
        <BillingDetails
          canManage={data.canManage}
          details={data.billingDetails}
          orgId={data.org.id}
        />
      </div>
    </div>
  );
}

import {
  CalendarIcon,
  CircleXIcon,
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
import {
  daysUntil,
  formatDate,
  intervalAdverb,
  intervalLabel,
} from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { nextChargeLabel, paystackEmailNote } from "@/lib/payment-copy";
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
      label: "Ends",
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
        <Amount label={nextChargeLabel(sub)} /> on {formatDate(when, "short")}
        <span className="font-normal text-panel-muted">
          {daysPhrase(daysUntil(when))}
        </span>
      </>
    ),
  };
}

/**
 * A downgrade waiting for the period end, and the way to undo it: asking for
 * the current plan again keeps it.
 */
function ScheduledChange({
  data,
  sub,
}: {
  data: BillingData;
  sub: SubscriptionSummary;
}) {
  const scheduled = sub.scheduled;
  if (!scheduled) {
    return null;
  }
  const when = formatDate(sub.currentPeriodEnd);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="text-panel-muted text-sm">
        Moves to {scheduled.planName} ({intervalAdverb(scheduled.interval)}) on{" "}
        {when}.
      </p>
      {data.canManage ? (
        <BillingAction
          action="change-plan"
          confirm={{
            title: `Keep ${sub.planName}?`,
            description: `${data.org.name} stays on ${sub.planName} after ${when} instead of moving to ${scheduled.planName}. Nothing is charged today; ${sub.priceLabel} is charged on ${when}.`,
            confirmLabel: `Keep ${sub.planName}`,
            cancelLabel: "Not now",
          }}
          orgId={data.org.id}
          planPriceId={sub.planPriceId}
          size="sm"
          successMessage={`${data.org.name} stays on ${sub.planName}`}
          variant="outline"
        >
          Keep {sub.planName}
        </BillingAction>
      ) : null}
    </div>
  );
}

/** Cancel sits apart from the panel's actions, with its own confirm. */
function CancelRow({
  data,
  sub,
}: {
  data: BillingData;
  sub: SubscriptionSummary;
}) {
  if (
    !data.canManage ||
    sub.status === "non_renewing" ||
    sub.cancelAtPeriodEnd ||
    sub.status === "past_due"
  ) {
    return null;
  }
  const cancelConfirm: BillingConfirm = {
    title: "Cancel at the end of this period?",
    description: `${data.org.name} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}, then moves to the Free plan (up to 3 members). You can resume any time before then.`,
    confirmLabel: "Cancel plan",
    cancelLabel: `Keep ${sub.planName}`,
    destructive: true,
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
      <p className="text-muted-foreground text-sm">
        Cancelling keeps {sub.planName} until {formatDate(sub.currentPeriodEnd)}
        .
      </p>
      <BillingAction
        action="cancel"
        className="max-sm:-ml-3"
        confirm={cancelConfirm}
        orgId={data.org.id}
        size="sm"
        successMessage={`${sub.planName} ends on ${formatDate(sub.currentPeriodEnd)}`}
        undo={{ label: `Resume ${sub.planName}`, action: "resume" }}
        variant="ghost"
      >
        Cancel plan
      </BillingAction>
    </div>
  );
}

/** No subscription yet: the Free plan, and which address Paystack bills. */
function FreePlan({ data }: { data: BillingData }) {
  const paystackNote = data.canManage
    ? paystackEmailNote(data.billingDetails.paystackEmail, false)
    : null;
  return (
    <Panel className="grid gap-6">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-xl">Free</h2>
      </div>
      <Money label={formatMoney(0, data.currency)} per="month" size="xl" />
      <p className="max-w-[52ch] text-panel-muted">
        Up to {data.seats.limit} members. Paid plans start with a 14-day trial;
        we check the card with a small charge that is refunded straight away.
      </p>
      {paystackNote ? (
        <p className="max-w-[52ch] text-panel-muted text-sm">{paystackNote}</p>
      ) : null}
    </Panel>
  );
}

function CurrentPlan({ data }: { data: BillingData }) {
  const sub = data.subscription;

  if (!sub) {
    return <FreePlan data={data} />;
  }

  const grace = daysUntil(sub.graceUntil);
  const trialDays = daysUntil(sub.trialEndsAt);
  const charge = nextCharge(sub);

  return (
    <div className="grid gap-3">
      {/* A container: beside an open sidebar on a tablet the panel is
          narrower than the viewport breakpoints assume. */}
      <Panel
        aria-labelledby="current-plan"
        className="@container grid gap-6 sm:gap-8"
      >
        <div className="flex flex-col gap-5 @2xl:flex-row @2xl:items-start @2xl:justify-between">
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
                    endsAt={sub.currentPeriodEnd}
                    status={
                      sub.cancelAtPeriodEnd && sub.status === "active"
                        ? "non_renewing"
                        : sub.status
                    }
                  />
                </SwapOnChange>
              </span>
            </div>
            <Money
              className="@max-md:text-[40px]"
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
        <dl className="grid gap-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-panel-line max-sm:rounded-card max-sm:bg-panel-tile max-sm:px-4 sm:grid-cols-2 lg:grid-cols-3">
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
        {sub.scheduled ? <ScheduledChange data={data} sub={sub} /> : null}
      </Panel>
      <CancelRow data={data} sub={sub} />
    </div>
  );
}

/** A checkout that failed: said on the page, not only in a toast. */
function PaymentFailed({ payment }: { payment: string | null }) {
  if (payment !== "failed" && payment !== "abandoned") {
    return null;
  }
  return (
    <div
      className="flex items-start gap-3 rounded-tile bg-destructive-bg p-4 sm:p-5"
      role="alert"
    >
      <CircleXIcon
        aria-hidden
        className="mt-0.5 size-5 shrink-0 text-destructive"
      />
      <div className="grid gap-1">
        <p className="font-semibold">Payment didn't go through</p>
        <p className="text-muted-foreground">
          Nothing was charged. Pick the plan again to retry, or use another
          card.
        </p>
      </div>
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
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-tile sm:hidden"
          data-sticky-action-bar
        >
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
    ? `${sub.planName}, ${intervalAdverb(sub.interval)} billing in ${data.currency}`
    : `Free plan, prices in ${data.currency}`;
  return (
    <div className="grid animate-content gap-10 pb-24 sm:gap-12 sm:pb-0">
      <PaymentToast payment={data.payment} sub={sub} />
      <PageHeader description={description} title="Billing" />
      <PaymentFailed payment={data.payment} />
      <PastDueBanner data={data} />
      <CurrentPlan data={data} />
      <section
        aria-labelledby="plans-title"
        className="grid scroll-mt-20 gap-5"
        id="plans"
      >
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
        <div className="scroll-mt-20" id="billing-details">
          <BillingDetails
            canManage={data.canManage}
            details={data.billingDetails}
            orgId={data.org.id}
          />
        </div>
      </div>
      {data.devTools ? (
        <DevBillingPanel orgId={data.org.id} status={sub?.status ?? null} />
      ) : null}
    </div>
  );
}

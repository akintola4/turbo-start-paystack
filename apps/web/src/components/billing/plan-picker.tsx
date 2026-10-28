"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { CheckCircle2Icon, CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  BillingAction,
  type BillingConfirm,
} from "@/components/billing/billing-action";
import { SwapOnChange } from "@/components/motion";
import { Chip, HighlightChip, Money } from "@/components/primitives";
import { formatDate, intervalLabel } from "@/lib/format";
import type {
  BillingData,
  PlanOption,
  SubscriptionSummary,
} from "@/lib/view-models";

type Interval = "monthly" | "annually";

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
          : `${orgName} moves to ${plan.name} straight away. We charge the difference for the rest of this period to the card on file, then ${plan.price.label} per ${intervalLabel(plan.price.interval, "long")}.`,
      confirmLabel: `Upgrade to ${plan.name}`,
      cancelLabel: "Not now",
    };
  }
  return {
    title: `Switch to ${plan.name}?`,
    description: `${orgName} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}, then moves to ${plan.name} at ${plan.price.label} per ${intervalLabel(plan.price.interval, "long")}. Nothing is charged today.`,
    confirmLabel: `Switch to ${plan.name}`,
    cancelLabel: "Not now",
  };
}

function PlanTiles({
  data,
  plans,
}: {
  data: BillingData;
  plans: PlanOption[];
}) {
  const sub = data.subscription;
  const blocked =
    sub &&
    (sub.status === "past_due" ||
      sub.status === "non_renewing" ||
      sub.cancelAtPeriodEnd);
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
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
              "relative flex flex-col gap-5 rounded-[20px] border bg-card p-6 shadow-tile transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/30 motion-reduce:transition-none",
              plan.isCurrent && "border-highlight ring-2 ring-highlight"
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
                <SwapOnChange value={plan.saving}>
                  <Chip dot={false} tone="positive">
                    {plan.saving}
                  </Chip>
                </SwapOnChange>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              {plan.price ? (
                <SwapOnChange value={plan.price.label}>
                  <Money
                    label={plan.price.label}
                    per={intervalLabel(plan.price.interval, "long")}
                  />
                </SwapOnChange>
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

/**
 * Monthly/annually switch. Both price lists are already on the page, so it
 * switches without a request; the URL keeps `?interval=` for sharing.
 */
function IntervalSwitch({
  value,
  onChange,
  saving,
}: {
  value: Interval;
  onChange: (next: Interval) => void;
  saving: string | null;
}) {
  const options: { key: Interval; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "annually", label: "Annually" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <fieldset className="relative grid grid-cols-2 rounded-full bg-muted p-1">
        <legend className="sr-only">Billing interval</legend>
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-background shadow-tile transition-transform duration-(--duration-popover) ease-out motion-reduce:transition-none",
            value === "annually" && "translate-x-full"
          )}
        />
        {options.map((o) => (
          <button
            aria-pressed={value === o.key}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center rounded-full px-4 font-medium text-sm outline-none transition-colors duration-(--duration-hover) focus-visible:ring-[3px] focus-visible:ring-ring/50",
              value === o.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={o.key}
            onClick={() => onChange(o.key)}
            type="button"
          >
            {o.label}
          </button>
        ))}
      </fieldset>
      {saving ? <HighlightChip>{saving} yearly</HighlightChip> : null}
    </div>
  );
}

export function PlanPicker({
  data,
  heading,
}: {
  data: BillingData;
  heading: ReactNode;
}) {
  const [interval, setPeriod] = useState<Interval>(data.interval);
  const saving =
    data.plans.annually.find((p) => p.key === "pro")?.saving ?? null;
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {heading}
        <IntervalSwitch
          onChange={(next) => {
            setPeriod(next);
            const url = new URL(window.location.href);
            url.searchParams.set("interval", next);
            window.history.replaceState(null, "", url);
          }}
          saving={saving}
          value={interval}
        />
      </div>
      <PlanTiles data={data} plans={data.plans[interval]} />
    </>
  );
}

"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { Badge } from "@workspace/ui/components/badge";
import { CheckIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

import {
  BillingAction,
  type BillingConfirm,
} from "@/components/billing/billing-action";
import { Money } from "@/components/primitives";
import { formatDate, intervalLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { freeTileCopy } from "@/lib/payment-copy";
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
    return;
  }
  const per = intervalLabel(plan.price.interval, "long");
  if (plan.change === "upgrade") {
    return {
      title: `Upgrade to ${plan.name}?`,
      description:
        sub.status === "trialing"
          ? `${orgName} moves to ${plan.name} now. You're still in the trial, so nothing is charged today.`
          : `${orgName} moves to ${plan.name} now. Today we charge the difference for the rest of this period to the card on file, then ${plan.price.label} per ${per}.`,
      confirmLabel: `Upgrade to ${plan.name}`,
      cancelLabel: "Not now",
    };
  }
  return {
    title: `Switch to ${plan.name}?`,
    description: `${orgName} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}, then moves to ${plan.name} at ${plan.price.label} per ${per}. Nothing is charged today.`,
    confirmLabel: `Switch to ${plan.name}`,
    cancelLabel: "Not now",
  };
}

function actionLabel(plan: PlanOption) {
  if (plan.action === "checkout") {
    return plan.trialDays
      ? `Start ${plan.trialDays}-day trial`
      : `Choose ${plan.name}`;
  }
  return plan.change === "upgrade"
    ? `Upgrade to ${plan.name}`
    : `Switch to ${plan.name}`;
}

function PlanFooter({
  plan,
  data,
  blocked,
}: {
  plan: PlanOption;
  data: BillingData;
  blocked: string | null;
}) {
  const sub = data.subscription;
  if (plan.isCurrent) {
    return (
      <p className="flex h-11 items-center gap-2 font-semibold text-muted-foreground text-sm">
        <CheckIcon aria-hidden className="size-4" />
        You're on this plan
      </p>
    );
  }
  if (!(plan.action && plan.price)) {
    // Free: downgrading means cancelling the paid plan.
    return (
      <p className="flex min-h-11 items-center text-muted-foreground text-sm">
        {freeTileCopy(sub)}
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <BillingAction
        action={plan.action}
        className="w-full"
        confirm={planConfirm(plan, sub, data.org.name)}
        disabled={!data.canManage || Boolean(blocked)}
        orgId={data.org.id}
        planPriceId={plan.price.id}
        publicKey={data.publicKey}
        successMessage={
          plan.change === "upgrade"
            ? `${data.org.name} is now on ${plan.name}`
            : `${plan.name} starts on ${formatDate(sub?.currentPeriodEnd ?? null)}`
        }
        variant={plan.change === "downgrade" ? "outline" : "default"}
      >
        {actionLabel(plan)}
      </BillingAction>
      {blocked ? (
        <p className="text-muted-foreground text-xs">{blocked}</p>
      ) : null}
    </div>
  );
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
    sub?.status === "past_due"
      ? "Paused until the failed payment is fixed."
      : sub?.status === "non_renewing" || sub?.cancelAtPeriodEnd
        ? "Resume your plan first."
        : null;
  return (
    // Three across only when the list itself is 48rem wide (not on an iPad
    // beside the sidebar); otherwise stacked, the current plan first.
    <div className="@container">
      <ul className="grid gap-4 @3xl:grid-cols-3">
        {plans.map((plan) => (
          <li
            className={cn(
              "flex flex-col gap-5 rounded-tile bg-card p-5 shadow-tile sm:p-6",
              // One sunflower mark per region: the badge. The ring is neutral.
              plan.isCurrent && "ring-2 ring-input",
              plan.isCurrent && "@max-3xl:order-first"
            )}
            key={plan.key}
          >
            <div className="flex min-h-6 items-center justify-between gap-2">
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              {plan.isCurrent ? (
                <Badge
                  variant={sub?.status === "past_due" ? "warning" : "highlight"}
                >
                  <CheckIcon aria-hidden />
                  Current plan
                </Badge>
              ) : plan.saving ? (
                <Badge variant="quiet">{plan.saving}</Badge>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Money
                label={plan.price?.label ?? formatMoney(0, data.currency)}
                per={intervalLabel(
                  plan.price?.interval ??
                    plans.find((p) => p.price)?.price?.interval ??
                    "monthly",
                  "long"
                )}
              />
              <p className="text-muted-foreground text-sm">
                {plan.description}
              </p>
            </div>
            <ul className="grid gap-2 border-border border-t pt-5 text-sm">
              {plan.features.map((f) => (
                <li className="flex items-center gap-2" key={f}>
                  <CheckIcon
                    aria-hidden
                    className="size-4 shrink-0 text-success"
                  />
                  {f}
                </li>
              ))}
              {plan.trialDays > 0 && !sub ? (
                <li className="flex items-center gap-2">
                  <CheckIcon
                    aria-hidden
                    className="size-4 shrink-0 text-success"
                  />
                  {plan.trialDays}-day trial, card required
                </li>
              ) : null}
            </ul>
            <div className="mt-auto">
              <PlanFooter blocked={blocked} data={data} plan={plan} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Monthly/annual radio group: one tab stop, arrow keys move, the thumb
 * slides. Both price lists are on the page, so it switches without a request;
 * the URL keeps `?interval=` for sharing.
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options: { key: Interval; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "annually", label: "Annually" },
  ];
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    const next = value === "monthly" ? "annually" : "monthly";
    onChange(next);
    refs.current[next === "monthly" ? 0 : 1]?.focus();
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        aria-label="Billing interval"
        className="relative grid h-11 grid-cols-2 rounded-control bg-surface-3 p-1 dark:bg-surface-1 dark:shadow-tile"
        onKeyDown={onKeyDown}
        role="radiogroup"
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-chip bg-surface-1 shadow-tile transition-transform duration-(--dur-base) ease-(--motion-ease-in-out) dark:bg-surface-3",
            value === "annually" && "translate-x-full"
          )}
        />
        {options.map((o, i) => (
          // biome-ignore lint/a11y/useSemanticElements: a styled radio group with a sliding thumb; roles and roving focus follow the ARIA pattern.
          <button
            aria-checked={value === o.key}
            className={cn(
              "pressable relative z-10 flex items-center justify-center rounded-chip px-4 font-semibold text-sm transition-colors duration-(--dur-fast) before:absolute before:-inset-y-1 before:inset-x-0",
              value === o.key
                ? "text-foreground"
                : // muted-foreground on surface-3 is 4.2:1, under AA.
                  "text-foreground/75 hover:text-foreground dark:text-muted-foreground"
            )}
            key={o.key}
            onClick={() => onChange(o.key)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            tabIndex={value === o.key ? 0 : -1}
            type="button"
          >
            {o.label}
          </button>
        ))}
      </div>
      {saving ? (
        <span className="text-muted-foreground text-sm">
          Annual billing saves {saving.replace(/^Save /, "")}
        </span>
      ) : null}
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

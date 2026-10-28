"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { useState } from "react";

import { BillingAction } from "@/components/shared/billing-action";
import type { BillingData, PlanOption } from "@/directions/types";
import { intervalLabel } from "@/lib/format";
import { money } from "./primitives";

function confirmFor(plan: PlanOption, data: BillingData) {
  const sub = data.subscription;
  if (!(plan.action === "change-plan" && plan.price && sub)) {
    return undefined;
  }
  const price = `${money(plan.price.label)} / ${intervalLabel(plan.price.interval, "long")}`;
  if (plan.change === "downgrade") {
    return {
      title: `Switch to ${plan.name} at the end of this period?`,
      description: `You keep ${sub.planName} until the current period ends, then ${plan.name} starts at ${price}. Nothing is charged today.`,
      confirmLabel: `Switch to ${plan.name}`,
      cancelLabel: "Cancel",
    };
  }
  return {
    title: `Upgrade to ${plan.name}?`,
    description:
      sub.status === "trialing"
        ? `${plan.name} applies straight away. Nothing is charged during the trial; ${price} starts when it ends.`
        : `${plan.name} applies straight away. Your saved card is charged the prorated difference for the rest of this period, then ${price}.`,
    confirmLabel: `Upgrade to ${plan.name}`,
    cancelLabel: "Cancel",
  };
}

export function PlanPicker({ data }: { data: BillingData }) {
  const current = data.plans.find((p) => p.isCurrent)?.key ?? "free";
  const [selected, setSelected] = useState(current);
  const plan = data.plans.find((p) => p.key === selected);
  const actionable = Boolean(plan?.action && plan.price);
  const blocked =
    data.subscription &&
    !["active", "trialing"].includes(data.subscription.status) &&
    plan?.action === "change-plan";

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <fieldset disabled={!data.canManage}>
        <legend className="sr-only">Plan</legend>
        <div className="divide-y">
          {data.plans.map((p) => {
            const checked = selected === p.key;
            return (
              <label
                className={cn(
                  "grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors has-[:focus-visible]:bg-accent/60 has-[:disabled]:cursor-default",
                  checked ? "bg-accent/50" : "hover:bg-accent/30"
                )}
                key={p.key}
              >
                <input
                  checked={checked}
                  className="peer sr-only"
                  name="plan"
                  onChange={() => setSelected(p.key)}
                  type="radio"
                  value={p.key}
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/60",
                    checked ? "border-foreground" : "border-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full bg-foreground transition-transform",
                      checked ? "scale-100" : "scale-0"
                    )}
                  />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[13.5px]">
                    <span className="font-medium">{p.name}</span>
                    {p.isCurrent ? (
                      <span className="rounded border px-1.5 py-px text-[11px] text-muted-foreground">
                        Current
                      </span>
                    ) : null}
                    {p.saving ? (
                      <span className="rounded bg-success/12 px-1.5 py-px text-[11px] text-success">
                        {p.saving}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-[12.5px] text-muted-foreground">
                    Up to {p.memberLimit} members
                    {p.features.filter((f) => !f.startsWith("Up to")).length
                      ? `, ${p.features
                          .filter((f) => !f.startsWith("Up to"))
                          .join(", ")
                          .toLowerCase()}`
                      : ""}
                    {p.trialDays && !data.subscription
                      ? `, ${p.trialDays}-day trial`
                      : ""}
                  </span>
                </span>
                <span className="text-right text-[13.5px] tabular-nums">
                  {p.price ? (
                    <>
                      {money(p.price.label)}
                      <span className="text-muted-foreground">
                        {" "}
                        / {intervalLabel(p.price.interval)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Free</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2.5 text-[12.5px] text-muted-foreground">
        <span className="min-w-0 flex-1">
          {!data.canManage
            ? "Only owners and billing managers can change the plan."
            : blocked
              ? data.subscription?.status === "past_due"
                ? "Update your card before changing plan."
                : "Resume the subscription before changing plan."
              : !actionable
                ? plan?.key === "free" && data.subscription
                  ? "To go back to Free, cancel the subscription below."
                  : "Select a plan to switch."
                : plan?.change === "downgrade"
                  ? "Takes effect at the end of the current period."
                  : plan?.action === "checkout"
                    ? "You'll finish on Paystack. Your card is saved for renewals."
                    : "Applies now. The difference is prorated."}
        </span>
        {plan?.price && plan.action ? (
          <BillingAction
            action={plan.action}
            className="h-8"
            confirm={confirmFor(plan, data)}
            disabled={!data.canManage || Boolean(blocked)}
            orgId={data.org.id}
            planPriceId={plan.price.id}
            publicKey={data.publicKey}
            size="sm"
          >
            {plan.action === "checkout"
              ? plan.trialDays
                ? `Start ${plan.name} trial`
                : `Continue to Paystack`
              : plan.change === "downgrade"
                ? `Switch to ${plan.name}`
                : `Upgrade to ${plan.name}`}
          </BillingAction>
        ) : (
          <span className="inline-flex h-8 items-center rounded-md border px-3 text-[13px] opacity-50">
            Switch plan
          </span>
        )}
      </div>
    </div>
  );
}

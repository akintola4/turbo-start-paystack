"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import { ArrowUpIcon, CheckIcon } from "lucide-react";
import Link from "next/link";

import {
  type Interval,
  useLanding,
} from "@/components/landing/currency-context";
import { opticalEdge } from "@/components/landing/display";
import { Segmented, type SegmentOption } from "@/components/landing/segmented";
import type { PlanInfo, PriceTable } from "@/components/landing/types";
import { Money, Panel } from "@/components/primitives";
import { currencyMeta } from "@/lib/landing";
import { formatMoney } from "@/lib/money";

const INTERVALS: SegmentOption<Interval>[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually", note: "2 months free" },
];

/** The plan whose button gets the strong fill: the one most teams pick. */
const SUGGESTED = "pro";

const TITLE = "Your pricing page, already built.";

/**
 * The pricing page the starter ships with, shown as a feature: the example
 * plans from the catalog, in the currency chosen on the hero wall. Nothing
 * here is the starter's own price (it is free); the buttons open the demo.
 */
export function Pricing({
  plans,
  prices,
}: {
  plans: PlanInfo[];
  prices: PriceTable;
}) {
  const { currency, interval, setInterval } = useLanding();
  const per = interval === "monthly" ? "month" : "year";
  return (
    <section
      aria-labelledby="pricing-title"
      className="landing-bleed scroll-mt-8"
      id="pricing"
    >
      <Panel className="grid gap-10 px-(--gut) py-8 sm:px-(--gut) sm:py-12 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-(--content-max)">
        <div className="landing-head">
          <div className="grid justify-items-start gap-4">
            <span className="rounded-chip bg-panel-tile px-2.5 py-1 font-semibold text-[13px] text-panel-muted">
              Demo · ships with the starter
            </span>
            <h2
              className="display-l"
              id="pricing-title"
              style={opticalEdge(TITLE)}
            >
              {TITLE}
            </h2>
          </div>
          <p className="text-pretty text-panel-muted">
            These are the example plans in{" "}
            <code className="font-mono text-[13px]">catalog.ts</code>. Swap in
            yours. Each organization locks its currency at its first checkout,
            and Paystack bills it in that currency from then on.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            className="pressable pressable-sm relative inline-flex items-center gap-2 self-start rounded-chip py-1 text-panel-muted text-sm before:absolute before:-inset-y-2 before:inset-x-0 hover:text-panel-foreground"
            href="#currency"
          >
            Priced in {currencyMeta(currency).word}. Pick another on the wall
            <ArrowUpIcon aria-hidden className="size-4" />
          </a>
          {/* A GET form so the switch works without JavaScript too. */}
          <form action="/#pricing" className="w-full sm:w-[19rem]" method="get">
            <input name="currency" type="hidden" value={currency} />
            <Segmented
              label="Billing interval"
              name="interval"
              onChange={setInterval}
              options={INTERVALS}
              size="md"
              tone="panel"
              value={interval}
            />
          </form>
        </div>
        <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
          {plans.map((plan) => {
            const amount =
              plan.key === "free" ? 0 : prices[currency][plan.key][interval];
            const suggested = plan.key === SUGGESTED;
            return (
              <li
                className="flex flex-col gap-6 rounded-tile bg-panel-tile p-5 sm:p-6"
                key={plan.key}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-[22px] tracking-[-0.02em]">
                    {plan.name}
                  </h3>
                  <span className="text-panel-muted text-sm">
                    {plan.trialDays > 0
                      ? `${plan.trialDays}-day trial`
                      : "No card needed"}
                  </span>
                </div>
                <div className="grid gap-2">
                  <Money
                    className="text-[clamp(40px,4.2vw,60px)] tracking-[-0.04em]"
                    label={formatMoney(amount, currency)}
                    per={per}
                  />
                  <p className="text-panel-muted text-sm">{plan.description}</p>
                </div>
                <ul className="grid gap-2 border-panel-line border-t pt-5 text-sm">
                  {plan.features.map((f) => (
                    <li className="flex items-center gap-2" key={f}>
                      <CheckIcon
                        aria-hidden
                        className="size-4 shrink-0 text-panel-muted"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  className={cn(
                    buttonVariants(),
                    "mt-auto",
                    suggested
                      ? "bg-panel-foreground text-panel hover:bg-[color-mix(in_oklch,var(--panel-foreground)_88%,var(--panel))]"
                      : "bg-panel-line text-panel-foreground hover:bg-[color-mix(in_oklch,var(--panel-line)_80%,var(--panel-foreground))]"
                  )}
                  href="/sign-up"
                >
                  Try {plan.name} in the demo
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-panel-muted text-sm">
          Starter and Pro start with a 14-day trial, card saved up front.
        </p>
      </Panel>
    </section>
  );
}

"use client";

import { CURRENCIES } from "@workspace/billing/money";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import {
  type Interval,
  useLanding,
} from "@/components/landing/currency-context";
import { nextRadioIndex } from "@/components/landing/radio";
import { type SegmentOption, Segmented } from "@/components/landing/segmented";
import type { PlanInfo, PriceTable } from "@/components/landing/types";
import { Money, Panel } from "@/components/primitives";
import { formatMoney } from "@/lib/money";
import { currencyMeta } from "@/lib/landing";

const INTERVALS: SegmentOption<Interval>[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually" },
];

/**
 * Currency radio group as tiles. One sunflower thumb slides between them
 * with a transform (interruptible, no layout), so the selected glyph is the
 * only sunflower in this panel.
 */
function CurrencySwitch() {
  const { currency, setCurrency } = useLanding();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = CURRENCIES.indexOf(currency);
  return (
    <div
      aria-label="Show prices in"
      className="relative grid w-full max-w-[26rem] grid-cols-5 gap-2"
      onKeyDown={(e) => {
        const next = nextRadioIndex(e, index, CURRENCIES.length);
        const code = next === null ? undefined : CURRENCIES[next];
        if (next !== null && code) {
          setCurrency(code);
          refs.current[next]?.focus();
        }
      }}
      role="radiogroup"
    >
      <span aria-hidden className="absolute inset-0 grid grid-cols-5 gap-2">
        {CURRENCIES.map((code) => (
          <span
            className="aspect-square rounded-card bg-panel-tile"
            key={code}
          />
        ))}
      </span>
      <span
        aria-hidden
        className="absolute top-0 left-0 aspect-square w-[calc((100%-4*0.5rem)/5)] rounded-card bg-highlight transition-transform duration-(--dur-base) ease-(--ease-in-out) motion-reduce:transition-none"
        style={{ transform: `translateX(calc(${index} * (100% + 0.5rem)))` }}
      />
      {CURRENCIES.map((code, i) => {
        const meta = currencyMeta(code);
        const on = code === currency;
        return (
          // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus and a sliding thumb.
          <button
            aria-checked={on}
            aria-label={`${meta.word} (${code})`}
            className={cn(
              "pressable pressable-sm relative grid aspect-square select-none place-content-center gap-0.5 rounded-card font-bold",
              on
                ? "text-highlight-foreground"
                : "text-panel-foreground hover:bg-panel-line"
            )}
            data-currency={code}
            key={code}
            onClick={() => setCurrency(code)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            tabIndex={on ? 0 : -1}
            type="button"
          >
            <span
              className={cn(
                "grid h-[clamp(22px,3vw,28px)] place-items-center leading-none",
                meta.glyph === "KSh"
                  ? "text-[clamp(15px,2.2vw,19px)]"
                  : "text-[clamp(22px,3vw,28px)]"
              )}
            >
              {meta.glyph}
            </span>
            <span
              className={cn(
                "text-center font-semibold text-[11px] max-[420px]:hidden",
                on ? "text-highlight-foreground" : "text-panel-muted"
              )}
            >
              {code}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function IntervalSwitch() {
  const { interval, setInterval } = useLanding();
  return (
    <Segmented
      className="w-full sm:w-[15rem]"
      label="Billing interval"
      onChange={setInterval}
      options={INTERVALS}
      size="md"
      tone="panel"
      value={interval}
    />
  );
}

export function Pricing({
  plans,
  prices,
}: {
  plans: PlanInfo[];
  prices: PriceTable;
}) {
  const { currency, interval } = useLanding();
  const per = interval === "monthly" ? "month" : "year";
  return (
    <section
      aria-labelledby="pricing-title"
      className="landing-bleed scroll-mt-4"
      id="pricing"
    >
      <Panel className="grid gap-8 px-(--gut) py-8 sm:px-(--gut) sm:py-12 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-(--content-max)">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
          <h2
            className="text-balance font-semibold text-[clamp(36px,5.4vw,80px)] leading-[0.96] tracking-[-0.045em]"
            id="pricing-title"
          >
            Pick your customers’ currency.
          </h2>
          <p className="text-pretty text-panel-muted">
            The example plans the starter ships with. Each organization locks
            its currency at its first checkout, and Paystack bills it in that
            currency from then on.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <CurrencySwitch />
          <IntervalSwitch />
        </div>
        <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
          {plans.map((plan) => {
            const amount =
              plan.key === "free" ? 0 : prices[currency][plan.key][interval];
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
                      <CheckIcon aria-hidden className="size-4 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  className={cn(
                    buttonVariants(),
                    "mt-auto bg-panel-line text-panel-foreground hover:bg-panel-line/70"
                  )}
                  href="/sign-up"
                >
                  Start with {plan.name}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-panel-muted text-sm">
          Starter and Pro start with a 14-day trial, card saved up front. Annual
          plans cost ten months.
        </p>
      </Panel>
    </section>
  );
}

"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { GlyphMosaic, Money, Panel, Tile } from "@/components/primitives";

export type CurrencyPlan = {
  key: string;
  name: string;
  description: string;
  monthly: string;
  trialDays: number;
  features: string[];
};

export type CurrencyTable = {
  code: string;
  glyph: string;
  name: string;
  plans: CurrencyPlan[];
}[];

const PLURAL: Record<string, string> = {
  NGN: "naira",
  GHS: "cedis",
  ZAR: "rand",
  KES: "shillings",
  USD: "dollars",
};

/** Currency radio group: one tab stop, arrows move, Home/End jump. */
function CurrencyRadios({
  table,
  value,
  onChange,
}: {
  table: CurrencyTable;
  value: string;
  onChange: (code: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = table.findIndex((t) => t.code === value);
  const move = (event: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: table.length - 1,
    };
    const raw = keys[event.key];
    if (raw === undefined) {
      return;
    }
    event.preventDefault();
    const next = (raw + table.length) % table.length;
    const code = table[next]?.code;
    if (code) {
      onChange(code);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      aria-label="Show prices in"
      className="grid grid-cols-5 gap-1 rounded-control bg-panel-tile p-1"
      onKeyDown={move}
      role="radiogroup"
    >
      {table.map((t, i) => (
        // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus and a styled thumb.
        <button
          aria-checked={t.code === value}
          aria-label={`${t.name} (${t.code})`}
          className={cn(
            "flex h-11 items-center justify-center rounded-chip font-semibold text-sm transition-[background-color,color] duration-(--dur-fast)",
            t.code === value
              ? "bg-highlight text-highlight-foreground"
              : "text-panel-muted hover:bg-panel-line hover:text-panel-foreground"
          )}
          key={t.code}
          onClick={() => onChange(t.code)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="radio"
          tabIndex={t.code === value ? 0 : -1}
          type="button"
        >
          {t.code}
        </button>
      ))}
    </div>
  );
}

/**
 * The landing's signature: the reference grid lights the tiles for the
 * chosen currency, and the plan prices below swap to it.
 */
export function CurrencyShowcase({ table }: { table: CurrencyTable }) {
  const [code, setCode] = useState(table[0]?.code ?? "NGN");
  const current = table.find((t) => t.code === code) ?? table[0];
  if (!current) {
    return null;
  }
  return (
    <>
      <Panel
        as="aside"
        aria-label="Currencies"
        className="grid gap-4 self-start p-4 sm:p-6"
      >
        <GlyphMosaic active={code} />
        <CurrencyRadios onChange={setCode} table={table} value={code} />
      </Panel>
      <section
        aria-labelledby="pricing-title"
        className="grid gap-6 md:col-span-2"
      >
        <div className="grid gap-2">
          <h2
            className="font-semibold text-[28px] leading-tight tracking-[-0.02em]"
            id="pricing-title"
          >
            Example plans, priced in {PLURAL[current.code] ?? current.code}
          </h2>
          <p className="max-w-[60ch] text-muted-foreground">
            Each organization locks its currency at the first checkout. Change
            the currency above to see what your customers would pay.
          </p>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {current.plans.map((plan) => (
            <li key={plan.key}>
              <Tile as="article" className="grid h-full content-start gap-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  {plan.trialDays > 0 ? (
                    <span className="text-muted-foreground text-sm">
                      {plan.trialDays}-day trial
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Money
                    label={plan.monthly}
                    per="month"
                    reserve={table.map(
                      (t) =>
                        t.plans.find((p) => p.key === plan.key)?.monthly ?? ""
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
                </ul>
              </Tile>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

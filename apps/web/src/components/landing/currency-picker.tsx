"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { GLYPHS, MOSAIC, Money, Panel, Tile } from "@/components/primitives";

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
 * The reference grid as controls: each tile selects its currency. Arrow keys
 * move focus around the 3 x 3 grid (one tab stop), Enter or Space selects.
 * Hover lifts a tile and press sinks it; the colour change runs on an inner
 * layer with a short stagger so it never delays the press feedback.
 */
function TileGrid({
  value,
  previous,
  onChange,
  names,
}: {
  value: string;
  previous: string | null;
  onChange: (code: string) => void;
  names: Record<string, string>;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstActive = Math.max(
    0,
    MOSAIC.findIndex((g) => GLYPHS[g]?.code === value)
  );
  const [focusIndex, setFocusIndex] = useState(firstActive);
  // Stagger only the tiles that change, in reading order, 30ms apart.
  const changing = MOSAIC.map((g, i) => ({ code: GLYPHS[g]?.code, i })).filter(
    (t) => t.code === value || t.code === previous
  );
  const delayOf = (i: number) =>
    Math.max(
      0,
      changing.findIndex((t) => t.i === i)
    ) * 30;

  const onKeyDown = (event: KeyboardEvent, i: number) => {
    const moves: Record<string, number> = {
      ArrowRight: i % 3 === 2 ? i : i + 1,
      ArrowLeft: i % 3 === 0 ? i : i - 1,
      ArrowDown: i + 3 > 8 ? i : i + 3,
      ArrowUp: i - 3 < 0 ? i : i - 3,
      Home: 0,
      End: 8,
    };
    const next = moves[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  return (
    <fieldset className="grid min-w-0 grid-cols-3 gap-3 sm:gap-4">
      <legend className="sr-only">Currencies</legend>
      {MOSAIC.map((g, i) => {
        const item = GLYPHS[g];
        if (!item) {
          return null;
        }
        const on = item.code === value;
        return (
          <button
            aria-label={`Show prices in ${names[item.code] ?? item.code}`}
            aria-pressed={on}
            className="group/tile relative aspect-square rounded-tile transition-transform duration-(--dur-fast) ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] active:duration-(--dur-press) motion-reduce:transition-none"
            key={`${item.code}-${i}`}
            onClick={() => {
              setFocusIndex(i);
              onChange(item.code);
            }}
            onFocus={() => setFocusIndex(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            tabIndex={i === focusIndex ? 0 : -1}
            type="button"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 flex select-none items-center justify-center rounded-tile font-bold transition-[background-color,color,scale] duration-(--dur-base) ease-out motion-reduce:transition-none",
                on
                  ? "scale-100 bg-highlight text-highlight-foreground"
                  : "scale-[0.97] bg-panel-tile text-panel-foreground group-hover/tile:bg-panel-line",
                item.glyph === "KSh"
                  ? "text-[clamp(22px,4.4vw,38px)]"
                  : "text-[clamp(30px,5.6vw,48px)]"
              )}
              style={{ transitionDelay: `${delayOf(i)}ms` }}
            >
              {item.glyph}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * The landing's signature: the reference grid lights the tiles for the
 * chosen currency, and the plan prices below swap to it.
 */
export function CurrencyShowcase({ table }: { table: CurrencyTable }) {
  const [code, setCodeState] = useState(table[0]?.code ?? "NGN");
  const [previous, setPrevious] = useState<string | null>(null);
  const setCode = (next: string) => {
    if (next === code) {
      return;
    }
    setPrevious(code);
    setCodeState(next);
  };
  const names = Object.fromEntries(table.map((t) => [t.code, t.name]));
  const proOf = (t: CurrencyTable[number]) =>
    t.plans.find((p) => p.key === "pro")?.monthly ?? "";
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
        <TileGrid
          names={names}
          onChange={setCode}
          previous={previous}
          value={code}
        />
        <div className="flex items-baseline justify-between gap-3 rounded-card bg-panel-tile px-4 py-3">
          <span className="font-semibold text-panel-muted text-sm">Pro</span>
          <Money label={proOf(current)} per="month" size="md" />
        </div>
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
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <span className="text-muted-foreground text-sm">
                    {plan.trialDays > 0
                      ? `${plan.trialDays}-day trial`
                      : "No card needed"}
                  </span>
                </div>
                <div className="grid gap-1.5">
                  <Money label={plan.monthly} per="month" />
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

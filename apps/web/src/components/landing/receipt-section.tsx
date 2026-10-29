"use client";

import NumberFlow from "@number-flow/react";
import { CURRENCIES } from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import { ArrowUpRightIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { NUMBER_TIMING } from "@/components/animated-number";
import { useLanding } from "@/components/landing/currency-context";
import { PaystackStatus } from "@/components/landing/paystack-status";
import { nextRadioIndex } from "@/components/landing/radio";
import { Mark, Panel } from "@/components/primitives";
import { gsap, MOTION_QUERIES, refreshAfterFonts, useGSAP } from "@/lib/gsap";
import { barcode, currencyMeta } from "@/lib/landing";
import { formatMoney } from "@/lib/money";
import { moneyFlowProps } from "@/lib/money-flow";

const REPO = "https://github.com/akintola4/turbo-start-paystack";

const LINE_ITEMS = [
  { label: "Source code", to: "GitHub", href: REPO },
  { label: "Docs", to: "README", href: `${REPO}#readme` },
  {
    label: "Paystack setup guide",
    to: "paystack-setup.md",
    href: `${REPO}/blob/main/docs/paystack-setup.md`,
  },
  { label: "Changelog", to: "Commits", href: `${REPO}/commits/main` },
  {
    label: "Security",
    to: "SECURITY.md",
    href: `${REPO}/blob/main/SECURITY.md`,
  },
  { label: "Licence", to: "MIT", href: `${REPO}/blob/main/LICENSE` },
];

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export type BuildInfo = { version: string; updated: string | null };

function AmountDue() {
  const { currency, setCurrency } = useLanding();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = CURRENCIES.indexOf(currency);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <span className="text-[13px] text-[var(--receipt-muted)]">
          Amount due
        </span>
        <span
          className="font-semibold text-[36px] leading-none tracking-[-0.03em]"
          data-amount-due
        >
          <span className="sr-only">{formatMoney(0, currency)}</span>
          <NumberFlow
            aria-hidden
            className="tabular-nums"
            {...moneyFlowProps(0, currency)}
            {...NUMBER_TIMING.money}
          />
        </span>
      </div>
      <div
        aria-label="Currency"
        className="flex gap-1"
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
        {CURRENCIES.map((code, i) => {
          const meta = currencyMeta(code);
          const on = code === currency;
          return (
            // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus.
            <button
              aria-checked={on}
              aria-label={meta.word}
              className={cn(
                "relative grid size-9 touch-manipulation place-items-center rounded-chip font-bold transition-[background-color,color] duration-(--dur-fast) before:absolute before:-inset-1",
                meta.glyph === "KSh" ? "text-[11px]" : "text-sm",
                on
                  ? "bg-panel text-panel-foreground"
                  : "bg-[var(--receipt-well)] hover:bg-[var(--receipt-rule)]"
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
              {meta.glyph}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaperTheme() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : null;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    THEMES.findIndex((t) => t.value === current)
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-[var(--receipt-muted)]">Paper</span>
      <div
        aria-label="Theme"
        className="flex gap-1"
        onKeyDown={(e) => {
          const next = nextRadioIndex(e, index, THEMES.length);
          const value = next === null ? undefined : THEMES[next]?.value;
          if (next !== null && value) {
            setTheme(value);
            refs.current[next]?.focus();
          }
        }}
        role="radiogroup"
      >
        {THEMES.map((t, i) => {
          const on = t.value === current;
          return (
            // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus.
            <button
              aria-checked={on}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-chip px-2.5 font-semibold text-[13px] transition-colors duration-(--dur-fast)",
                on
                  ? "bg-[var(--receipt-well)] text-[var(--receipt-ink)]"
                  : "text-[var(--receipt-muted)] hover:text-[var(--receipt-ink)]"
              )}
              key={t.value}
              onClick={() => setTheme(t.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              tabIndex={(current === null ? i === 2 : on) ? 0 : -1}
              type="button"
            >
              <t.icon aria-hidden className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The site footer: a receipt that feeds out of a slot in the forest panel as
 * you scroll to it (1:1 with the scrollbar, final state under reduced
 * motion and in the server HTML). Links are its line items; the amount due
 * is zero in every currency.
 */
export function ReceiptFooter({ build }: { build: BuildInfo }) {
  const root = useRef<HTMLDivElement>(null);
  const bars = barcode(`turbo-start-paystack@${build.version}`);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        if (!ctx.conditions?.motion) {
          return;
        }
        gsap.fromTo(
          "[data-receipt-paper]",
          { yPercent: -72 },
          {
            yPercent: 0,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-receipt-feeder]",
              start: "top 95%",
              end: "top 25%",
              scrub: true,
            },
          }
        );
      });
      refreshAfterFonts();
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <footer className="mx-2 mt-16 mb-[max(0.5rem,env(safe-area-inset-bottom))] sm:mx-3 sm:mt-24 sm:mb-3">
      <Panel
        as="div"
        className="mx-auto max-w-[1440px] overflow-hidden px-4 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6"
      >
        <div ref={root}>
          <div data-receipt-feeder>
            <div className="mx-auto flex max-w-[40rem] items-center justify-between gap-3 text-panel-muted text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-panel-foreground">
                <Mark className="size-6" />
                Turbo Start Paystack
              </span>
            </div>
            <div
              aria-hidden
              className="relative z-10 mx-auto mt-4 h-2.5 max-w-[40rem] rounded-chip bg-[var(--forest-950)] shadow-[inset_0_2px_0_oklch(0_0_0/0.35)]"
            />
            {/* The clip: the paper slides out from under the slot. */}
            <div className="mx-auto -mt-[5px] max-w-[37.5rem] overflow-hidden px-0 pb-4 sm:px-0">
              <div className="receipt-paper relative" data-receipt-paper>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-lg tracking-[-0.01em]">
                    Receipt for cloning
                  </p>
                  <p className="text-right text-[13px] text-[var(--receipt-muted)]">
                    1 × SaaS starter
                    <br />
                    No card needed
                  </p>
                </div>
                <hr className="receipt-rule" />
                <nav aria-label="Footer">
                  <ul className="grid">
                    {LINE_ITEMS.map((item) => (
                      <li key={item.label}>
                        <a className="receipt-line group" href={item.href}>
                          <span className="shrink-0 whitespace-nowrap font-medium">
                            {item.label}
                          </span>
                          <span aria-hidden className="receipt-leader" />
                          <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-[var(--receipt-muted)] transition-colors duration-(--dur-fast) group-hover:text-[var(--receipt-ink)]">
                            <span className="truncate">{item.to}</span>
                            <ArrowUpRightIcon
                              aria-hidden
                              className="size-3.5"
                            />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
                <hr className="receipt-rule" />
                <AmountDue />
                <hr className="receipt-rule" />
                <PaperTheme />
                <div aria-hidden className="mt-5 flex h-11 gap-px">
                  {bars.map((w, i) => (
                    <span
                      className={i % 2 ? "" : "bg-[var(--receipt-ink)]"}
                      key={i}
                      style={{ flexGrow: w }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-center text-[12.5px] text-[var(--receipt-muted)]">
                  Thank you for cloning.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-panel-line border-t pt-5 text-[13px] text-panel-muted lg:justify-between">
            <PaystackStatus />
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <a
                className="rounded-chip underline-offset-4 transition-colors duration-(--dur-fast) hover:text-panel-foreground hover:underline"
                href={`${REPO}/commits/main`}
              >
                Version {build.version}
              </a>
              {build.updated ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Updated {build.updated}</span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <a
                className="rounded-chip underline-offset-4 transition-colors duration-(--dur-fast) hover:text-panel-foreground hover:underline"
                href={`${REPO}/blob/main/LICENSE`}
              >
                MIT licence
              </a>
            </p>
            <p>Not affiliated with Paystack.</p>
          </div>
        </div>
      </Panel>
    </footer>
  );
}

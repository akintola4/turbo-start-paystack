"use client";

import {
  CURRENCIES,
  CURRENCY_SYMBOL,
  type Currency,
} from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useRef } from "react";

import { useLanding } from "@/components/landing/currency-context";
import { PaystackStatus } from "@/components/landing/paystack-status";
import { nextRadioIndex } from "@/components/landing/radio";
import { useCopyCommand } from "@/components/landing/start-command";
import { THEMES, useThemeChoice } from "@/components/landing/theme-choice";
import { Panel } from "@/components/primitives";
import { gsap, MOTION_QUERIES, useGSAP } from "@/lib/gsap";
import { currencyMeta } from "@/lib/landing";

const REPO = "https://github.com/akintola4/turbo-start-paystack";

export type BuildInfo = { version: string; updated: string | null };

/**
 * Symbol size inside the wordmark tile, in wordmark ems. The tile is a
 * cap-height square (0.71em); each symbol is sized so its ink stays inside
 * the middle 80% of the tile. Widths measured in Geist 700: ₦ 0.77, R 0.70,
 * $ 0.67, KSh 1.95, GH₵ 2.23 (em of their own size).
 */
const GLYPH_SIZE: Record<Currency, string> = {
  NGN: "0.44em",
  GHS: "0.24em",
  ZAR: "0.44em",
  KES: "0.27em",
  USD: "0.44em",
};

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Starter",
    links: [
      { label: "Pricing", href: "#pricing" },
      { label: "Webhooks", href: "#webhooks" },
      { label: "Changelog", href: `${REPO}/commits/main`, external: true },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "README", href: `${REPO}#readme`, external: true },
      {
        label: "Paystack setup",
        href: `${REPO}/blob/main/docs/paystack-setup.md`,
        external: true,
      },
      {
        label: "Contributing",
        href: `${REPO}/blob/main/CONTRIBUTING.md`,
        external: true,
      },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: REPO, external: true },
      {
        label: "MIT licence",
        href: `${REPO}/blob/main/LICENSE`,
        external: true,
      },
      {
        label: "Security",
        href: `${REPO}/blob/main/SECURITY.md`,
        external: true,
      },
    ],
  },
];

const metaLink =
  "rounded-chip underline-offset-4 transition-colors duration-(--dur-fast) hover:text-panel-foreground hover:underline";

/** Column headings and the first line of each column share one cap line. */
const HEADING =
  "font-semibold text-[13px] text-panel-muted [text-box:trim-both_cap_alphabetic]";

function FooterCommand() {
  const { copied, copy } = useCopyCommand();
  return (
    <div className="flex max-w-[30rem] items-center gap-2 rounded-control bg-panel-tile py-1.5 pr-1.5 pl-3.5">
      <code
        className="min-w-0 flex-1 select-all font-mono text-[13px] leading-5"
        data-footer-command
      >
        <span className="whitespace-nowrap">npx degit</span>{" "}
        <span className="whitespace-nowrap">akintola4/</span>
        <wbr />
        <span className="whitespace-nowrap">turbo-start-paystack</span>{" "}
        <span className="whitespace-nowrap text-panel-muted">my-saas</span>
      </code>
      <button
        aria-label={copied ? "Copied" : "Copy the install command"}
        className="relative grid size-9 shrink-0 touch-manipulation place-items-center rounded-chip transition-[background-color,scale] duration-(--dur-fast) ease-out before:absolute before:-inset-1 hover:bg-panel-line active:scale-[0.96]"
        onClick={copy}
        type="button"
      >
        <CopyIcon
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 size-4 transition-opacity duration-(--dur-fast)",
            copied && "opacity-0"
          )}
        />
        <CheckIcon
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 size-4 transition-opacity duration-(--dur-fast)",
            !copied && "opacity-0"
          )}
        />
      </button>
    </div>
  );
}

function PricesIn() {
  const { currency, setCurrency } = useLanding();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = CURRENCIES.indexOf(currency);
  return (
    <div className="grid justify-items-start gap-3">
      <h3 className={HEADING} id="footer-prices">
        Prices in
      </h3>
      <div
        aria-labelledby="footer-prices"
        className="flex gap-1.5"
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
              aria-label={`${meta.word} (${code})`}
              className={cn(
                "grid size-11 touch-manipulation select-none place-items-center rounded-control font-bold transition-[background-color,color,scale] duration-(--dur-fast) ease-out active:scale-[0.96]",
                meta.glyph === "KSh" ? "text-xs" : "text-[17px]",
                on
                  ? "bg-highlight text-highlight-foreground"
                  : "bg-panel-tile text-panel-foreground hover:bg-panel-line"
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

const THEME_ICON = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

function ThemeSwitch() {
  const { current, setTheme } = useThemeChoice();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    THEMES.findIndex((t) => t.value === current)
  );
  return (
    <div className="grid justify-items-start gap-3">
      <h3 className={HEADING} id="footer-theme">
        Theme
      </h3>
      <div
        aria-labelledby="footer-theme"
        className="inline-flex gap-1 rounded-control bg-panel-tile p-1"
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
          const Icon = THEME_ICON[t.value];
          return (
            // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus.
            <button
              aria-checked={on}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-chip px-2.5 font-semibold text-[13px] transition-colors duration-(--dur-fast)",
                on
                  ? "bg-panel-foreground text-panel"
                  : "text-panel-muted hover:text-panel-foreground"
              )}
              data-theme-choice={t.value}
              key={t.value}
              onClick={() => setTheme(t.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              tabIndex={(current === null ? i === 2 : on) ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The site footer, as in the Money in motion concept: the install command,
 * three link columns, and the page's currency and theme controls; then live
 * Paystack status and build info; then a wordmark that fills the panel, its
 * sunflower tile showing the currency chosen anywhere on the page.
 */
export function SiteFooter({ build }: { build: BuildInfo }) {
  const { currency } = useLanding();
  const root = useRef<HTMLDivElement>(null);

  // The words and the tile rise out of the clip edge, 1:1 with the scroll,
  // over the last stretch of the page. Reduced motion shows them in place.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        if (!ctx.conditions?.motion) {
          return;
        }
        gsap.fromTo(
          "[data-wordmark-part]",
          { yPercent: 105 },
          {
            yPercent: 0,
            ease: "none",
            stagger: 0.12,
            scrollTrigger: {
              trigger: "[data-wordmark]",
              start: "top bottom",
              end: "bottom bottom",
              scrub: true,
            },
          }
        );
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <footer className="mx-2 mt-3 mb-[max(0.5rem,env(safe-area-inset-bottom))] sm:mx-3 sm:mb-3">
      <Panel
        as="div"
        className="mx-auto max-w-[1440px] px-4 pt-8 pb-0 sm:px-8 sm:pt-10 sm:pb-0"
      >
        <div className="@container" ref={root}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:grid-cols-[minmax(0,2.8fr)_repeat(3,minmax(0,1fr))_auto] xl:gap-x-8">
            <div className="col-span-2 grid content-start justify-items-start gap-5 md:col-span-3 lg:col-span-4 xl:col-span-1">
              <p className="max-w-[18ch] text-balance font-semibold text-[22px] leading-[1.2] tracking-[-0.02em] [text-box:trim-both_cap_alphabetic]">
                Start from billing that already works.
              </p>
              <FooterCommand />
            </div>
            {COLUMNS.map((col) => (
              <nav
                aria-labelledby={`footer-${col.title.toLowerCase()}`}
                className="grid content-start gap-3"
                key={col.title}
              >
                <h3
                  className={HEADING}
                  id={`footer-${col.title.toLowerCase()}`}
                >
                  {col.title}
                </h3>
                <ul className="grid gap-0.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        className="inline-flex items-center gap-1 rounded-chip py-1.5 text-[15px] transition-colors duration-(--dur-fast) hover:text-highlight"
                        href={link.href}
                      >
                        {link.label}
                        {link.external ? (
                          <ArrowUpRightIcon
                            aria-hidden
                            className="size-3.5 text-panel-muted"
                          />
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="col-span-2 grid content-start justify-items-start gap-6 md:col-span-3 lg:col-span-1">
              <PricesIn />
              <ThemeSwitch />
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-panel-line border-t pt-5 text-[13px] text-panel-muted lg:justify-between">
            <PaystackStatus />
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <a className={metaLink} href={`${REPO}/commits/main`}>
                Version {build.version}
              </a>
              {/* Each separator travels with the item after it, so a wrap
                  never leaves a dot hanging at the end of a line. */}
              {build.updated ? (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span aria-hidden>·</span>
                  Updated {build.updated}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span aria-hidden>·</span>
                <a className={metaLink} href={`${REPO}/blob/main/LICENSE`}>
                  MIT licence
                </a>
              </span>
            </p>
            <p>Not affiliated with Paystack.</p>
          </div>

          {/* The wordmark. Its font size is the container width divided by
              its measured width in ems (text 4.674 + gap 0.1 + tile 0.71,
              plus a hair of slack), so it fills the panel and never spills. */}
          <div
            aria-hidden
            className="mt-[clamp(20px,4cqw,48px)] overflow-hidden"
            data-wordmark
          >
            <p className="footer-wordmark">
              <span className="inline-block" data-wordmark-part>
                turbo
              </span>{" "}
              <span className="inline-block" data-wordmark-part>
                start
              </span>
              <span className="footer-wordmark-tile" data-wordmark-part>
                {CURRENCIES.map((code) => (
                  <span
                    className={cn(
                      "footer-wordmark-glyph",
                      code === currency && "is-on"
                    )}
                    data-currency={code}
                    key={code}
                    style={{ fontSize: GLYPH_SIZE[code] }}
                  >
                    <span>{CURRENCY_SYMBOL[code].trim()}</span>
                  </span>
                ))}
              </span>
            </p>
          </div>
        </div>
      </Panel>
    </footer>
  );
}

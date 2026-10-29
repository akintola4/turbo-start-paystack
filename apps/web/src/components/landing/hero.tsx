"use client";

import type { Currency } from "@workspace/billing/money";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import { MousePointer2Icon } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useRef, useState } from "react";

import { useLanding } from "@/components/landing/currency-context";
import type { PriceTable } from "@/components/landing/types";
import { Money, Panel, Wordmark } from "@/components/primitives";
import { formatMoney } from "@/lib/money";
import { gsap, MOTION_QUERIES, SplitText, useGSAP } from "@/lib/gsap";
import { currencyMeta, rippleDelay, WALL } from "@/lib/landing";

const REPO = "https://github.com/akintola4/turbo-start-paystack";

/** Columns of the wall at the current width (8 on large screens, else 4). */
function wallColumns(el: HTMLElement | null) {
  if (!el) {
    return 8;
  }
  return getComputedStyle(el).gridTemplateColumns.split(" ").length;
}

/**
 * The hero: a forest panel with a wall of currency tiles. Pointing at (or
 * focusing, or tapping) a tile lights every tile of that currency, rippling
 * out from it, and the Pro price rolls to that currency. The same choice
 * drives pricing and the footer receipt.
 */
export function Hero({ prices }: { prices: PriceTable }) {
  const { currency, origin, setCurrency } = useLanding();
  const root = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLFieldSetElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const playIntro = useRef<boolean | null>(null);

  const pro = prices[currency].pro.monthly;
  const columns = wallColumns(wall.current);
  const from = origin.source === "wall" ? origin.index : WALL.indexOf(currency);

  const pick = (code: Currency, index: number) => {
    if (code !== currency) {
      setCurrency(code, { source: "wall", index });
    }
  };

  const onKeyDown = (event: KeyboardEvent, i: number) => {
    const visible = tiles.current.filter((t) => t?.offsetParent).length;
    const cols = wallColumns(wall.current);
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: i + cols,
      ArrowUp: i - cols,
      Home: 0,
      End: visible - 1,
    };
    const next = moves[event.key];
    if (next === undefined || next < 0 || next >= visible) {
      return;
    }
    event.preventDefault();
    setFocusIndex(next);
    tiles.current[next]?.focus();
  };

  // One intro per session (the intro gate in the root layout decides and hides
  // the parts first, so the server HTML is the final state for everyone else).
  useGSAP(
    () => {
      const html = document.documentElement;
      // Decide once per mount. Strict Mode runs this effect twice; the first
      // run removes the gate class, so the second must not re-read it.
      if (playIntro.current === null) {
        playIntro.current = html.getAttribute("data-intro") === "play";
      }
      if (!playIntro.current) {
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        if (!ctx.conditions?.motion) {
          html.removeAttribute("data-intro");
          return;
        }
        // Reveal first, so `from()` tweens back to the real resting values;
        // its start state renders in this same frame, before any paint.
        html.removeAttribute("data-intro");
        const split = SplitText.create("[data-hero-title]", {
          type: "lines",
          mask: "lines",
        });
        gsap.set(split.masks, {
          paddingBlock: "0.06em 0.14em",
          marginBlock: "-0.06em -0.14em",
        });
        const visible = tiles.current.filter((t): t is HTMLButtonElement =>
          Boolean(t?.offsetParent)
        );
        const cols = wallColumns(wall.current);
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.from(split.lines, { yPercent: 115, duration: 1.1, stagger: 0.1 })
          .from(
            "[data-hero-fade]",
            {
              opacity: 0,
              y: 12,
              duration: 0.6,
              stagger: 0.06,
              ease: "power3.out",
            },
            0.3
          )
          .from(
            visible,
            {
              opacity: 0,
              scale: 0.92,
              y: 20,
              duration: 0.9,
              stagger: {
                each: 0.035,
                grid: [Math.ceil(visible.length / cols), cols],
                from: "start",
              },
            },
            0.25
          );
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <Panel
      aria-label="Turbo Start Paystack"
      as="section"
      className="mx-2 flex min-h-[calc(100svh-16px)] flex-col p-0 sm:mx-3 sm:min-h-[calc(100svh-24px)] sm:p-0"
    >
      <div
        className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pb-4 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12"
        ref={root}
      >
        <header className="flex items-center justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
          <Wordmark className="text-panel-foreground" />
          <nav aria-label="Primary" className="flex items-center gap-1">
            <a
              className="hidden pressable pressable-sm rounded-control px-3 py-2.5 font-medium text-[15px] text-panel-muted hover:bg-panel-tile hover:text-panel-foreground lg:inline-flex"
              href="#pricing"
            >
              Pricing
            </a>
            <a
              className="hidden pressable pressable-sm rounded-control px-3 py-2.5 font-medium text-[15px] text-panel-muted hover:bg-panel-tile hover:text-panel-foreground lg:inline-flex"
              href="#webhooks"
            >
              How billing works
            </a>
            <a
              className="hidden pressable pressable-sm rounded-control px-3 py-2.5 font-medium text-[15px] text-panel-muted hover:bg-panel-tile hover:text-panel-foreground lg:inline-flex"
              href={`${REPO}#readme`}
            >
              Docs
            </a>
            <Link
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "text-panel-foreground"
              )}
              href="/sign-in"
            >
              Sign in
            </Link>
            <Link
              className={cn(buttonVariants(), "max-sm:hidden")}
              href="/sign-up"
            >
              Start a workspace
            </Link>
          </nav>
        </header>

        <div className="grid gap-6 pt-[clamp(8px,4vh,56px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-8">
          <h1
            className="text-balance font-semibold text-[clamp(48px,8.6vw,148px)] leading-[0.9] tracking-[-0.055em]"
            data-hero-title
          >
            <span className="block">Every price,</span>
            <span className="block">in their money.</span>
          </h1>
          <div className="grid gap-5 pb-2" data-hero-fade>
            <p className="text-pretty text-[17px] text-panel-muted">
              An open-source Next.js starter for selling subscriptions across
              Africa: organizations, roles and Paystack billing in naira, cedis,
              rand, shillings and dollars.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link className={buttonVariants({ size: "lg" })} href="/sign-up">
                Start a workspace
              </Link>
              <a
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-panel-tile text-panel-foreground hover:bg-panel-line"
                )}
                href="#start"
              >
                Clone the starter
              </a>
            </div>
          </div>
        </div>

        <div
          className="mt-auto flex items-center justify-between gap-4 pt-[clamp(24px,4vh,40px)] pb-4"
          data-hero-fade
        >
          <p
            aria-live="polite"
            className="inline-flex items-baseline gap-2.5 rounded-card bg-panel-tile px-4 py-2.5 font-medium text-[15px] text-panel-muted"
            data-hero-price
          >
            Pro
            <Money
              className="text-[26px] text-panel-foreground"
              label={formatMoney(pro, currency)}
              per="month"
              size="md"
            />
          </p>
          <p className="hidden items-center gap-2 text-panel-muted text-sm sm:flex">
            <MousePointer2Icon aria-hidden className="size-4" />
            Point at a currency
          </p>
        </div>

        <fieldset
          className="m-0 grid min-w-0 grid-cols-4 gap-2 border-0 p-0 sm:gap-3 lg:grid-cols-8 lg:gap-4"
          ref={wall}
        >
          <legend className="sr-only">Preview prices in a currency</legend>
          {WALL.map((code, i) => {
            const meta = currencyMeta(code);
            const on = code === currency;
            return (
              <button
                aria-label={`Show prices in ${meta.word}`}
                aria-pressed={on}
                className={cn(
                  "pressable pressable-sm grid aspect-square select-none place-items-center rounded-card font-bold motion-reduce:transition-none sm:rounded-tile",
                  "touch-manipulation max-lg:[&:nth-of-type(n+13)]:hidden",
                  on
                    ? "bg-highlight text-highlight-foreground"
                    : "bg-panel-tile text-panel-foreground hover:bg-panel-line",
                  meta.glyph === "KSh"
                    ? "text-[clamp(18px,3vw,46px)]"
                    : "text-[clamp(26px,4.2vw,64px)]"
                )}
                data-currency={code}
                data-wall-tile
                key={`${code}-${i}`}
                onClick={() => pick(code, i)}
                onFocus={() => {
                  setFocusIndex(i);
                  pick(code, i);
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") {
                    pick(code, i);
                  }
                }}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                style={{
                  // Order follows `pressable`: scale and opacity never wait; colour ripples.
                  transitionDelay: `0ms, 0ms, ${rippleDelay(i, Math.max(0, from), columns)}ms, ${rippleDelay(i, Math.max(0, from), columns)}ms`,
                }}
                tabIndex={i === focusIndex ? 0 : -1}
                type="button"
              >
                {meta.glyph}
              </button>
            );
          })}
        </fieldset>
      </div>
    </Panel>
  );
}

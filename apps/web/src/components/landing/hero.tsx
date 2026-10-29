"use client";

import type { Currency } from "@workspace/billing/money";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import { MousePointer2Icon } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { useLanding } from "@/components/landing/currency-context";
import { opticalEdge } from "@/components/landing/display";
import type { PriceTable } from "@/components/landing/types";
import { Money, Panel, Wordmark } from "@/components/primitives";
import { formatMoney } from "@/lib/money";
import { gsap, MOTION_QUERIES, SplitText, useGSAP } from "@/lib/gsap";
import { currencyMeta, REPO, rippleDelay, WALL } from "@/lib/landing";

const NAV = [
  { label: "How billing works", href: "#webhooks" },
  { label: "Features", href: "#features" },
  { label: "Pricing page", href: "#pricing" },
  { label: "Docs", href: `${REPO}#readme` },
];

const navLink =
  "hidden pressable pressable-sm rounded-control px-3 py-2.5 font-medium text-[15px] text-panel-muted hover:bg-panel-tile hover:text-panel-foreground lg:inline-flex";

/** Columns of the wall grid as laid out right now (8 on large screens, 4 below). */
function useColumns(ref: React.RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(8);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const read = () =>
      setColumns(getComputedStyle(el).gridTemplateColumns.split(" ").length);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return columns;
}

const LINES = ["Every price,", "in their money."];

/**
 * The hero: a forest panel with a wall of currency tiles, the page's one
 * currency control. Pointing at a tile previews that currency here (the
 * matching tiles light up, rippling out from it, and the example price
 * rolls); a click, tap or arrow key chooses it for the whole page.
 */
export function Hero({ prices }: { prices: PriceTable }) {
  const { currency, shown, origin, setCurrency, preview } = useLanding();
  const root = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(0, WALL.indexOf(currency))
  );
  const playIntro = useRef<boolean | null>(null);
  const columns = useColumns(wall);

  const pro = prices[shown].pro.monthly;
  const from = Math.max(
    0,
    origin.source === "wall" ? origin.index : WALL.indexOf(shown)
  );

  const choose = (code: Currency, index: number) => {
    if (code !== currency) {
      setCurrency(code, { source: "wall", index });
    }
  };

  // Radio-group keys: arrows move across the visible grid and choose.
  const onKeyDown = (event: KeyboardEvent, i: number) => {
    const visible = tiles.current.filter((t) => t?.offsetParent).length;
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: i + columns,
      ArrowUp: i - columns,
      Home: 0,
      End: visible - 1,
    };
    const next = moves[event.key];
    const code = next === undefined ? undefined : WALL[next];
    if (next === undefined || !code || next < 0 || next >= visible) {
      return;
    }
    event.preventDefault();
    setFocusIndex(next);
    tiles.current[next]?.focus();
    choose(code, next);
  };

  // One intro per session (the intro gate in the root layout decides and hides
  // the parts first, so the server HTML is the final state for everyone else).
  useGSAP(
    () => {
      const html = document.documentElement;
      // Decide once per mount. Strict Mode runs this effect twice; the first
      // run removes the gate attribute, so the second must not re-read it.
      if (playIntro.current === null) {
        playIntro.current = html.getAttribute("data-intro") === "play";
      }
      if (!playIntro.current) {
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        html.removeAttribute("data-intro");
        if (!ctx.conditions?.motion) {
          return;
        }
        const split = SplitText.create("[data-hero-line]", {
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
        const cols = getComputedStyle(
          wall.current as HTMLElement
        ).gridTemplateColumns.split(" ").length;
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
      className="landing-bleed flex min-h-[calc(100svh-2*var(--edge))] flex-col p-0 sm:p-0"
    >
      <div className="landing-inner flex flex-1 flex-col pb-(--gut)" ref={root}>
        <header className="flex items-center justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
          <Wordmark className="text-panel-foreground" />
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV.map((item) => (
              <a className={navLink} href={item.href} key={item.label}>
                {item.label}
              </a>
            ))}
            <Link
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "text-panel-foreground"
              )}
              href="/sign-in"
            >
              Sign in
            </Link>
            <a
              className={cn(
                buttonVariants(),
                "bg-panel-tile text-panel-foreground hover:bg-panel-line max-sm:hidden"
              )}
              href={REPO}
            >
              GitHub
            </a>
          </nav>
        </header>

        <div className="grid gap-6 pt-[clamp(8px,4vh,56px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-8">
          <h1 className="display-xl" data-hero-title>
            {LINES.map((line) => (
              <span
                className="block"
                data-hero-line
                key={line}
                style={opticalEdge(line)}
              >
                {line}
              </span>
            ))}
          </h1>
          <div className="grid gap-5 pb-2" data-hero-fade>
            <p className="text-pretty text-[17px] text-panel-muted">
              A free, MIT-licensed Next.js starter for selling subscriptions
              across Africa: organizations, roles and Paystack billing in naira,
              cedis, rand, shillings and dollars. Better Auth, Drizzle and
              Postgres underneath.
            </p>
            <div className="grid gap-2.5 min-[420px]:flex min-[420px]:flex-wrap">
              <a className={buttonVariants({ size: "lg" })} href="#start">
                Clone the starter
              </a>
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-panel-tile text-panel-foreground hover:bg-panel-line"
                )}
                href="/sign-up"
              >
                Try the live demo
              </Link>
            </div>
          </div>
        </div>

        <div
          className="mt-[clamp(24px,6vh,64px)] flex items-center justify-between gap-4 pb-4 lg:mt-auto lg:pt-[clamp(24px,4vh,40px)]"
          data-hero-fade
        >
          <p
            aria-live="polite"
            className="inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-card bg-panel-tile px-4 py-2.5 font-medium text-[15px] text-panel-muted"
            data-hero-price
          >
            Your customers see
            <Money
              className="text-[26px] text-panel-foreground"
              label={formatMoney(pro, shown)}
              per="month"
              size="md"
            />
          </p>
          <p className="hidden items-center gap-2 text-panel-muted text-sm pointer-fine:sm:flex">
            <MousePointer2Icon aria-hidden className="size-4" />
            Point at a currency
          </p>
        </div>

        <div
          aria-label="Currency for every price on this page"
          className="grid min-w-0 scroll-mt-8 grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8 lg:gap-4"
          data-wall
          id="currency"
          onPointerLeave={() => preview(null)}
          ref={wall}
          role="radiogroup"
        >
          {WALL.map((code, i) => {
            const meta = currencyMeta(code);
            const lit = code === shown;
            return (
              // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus over a grid of tiles.
              <button
                aria-checked={code === currency}
                aria-label={meta.word}
                className={cn(
                  "wall-tile pressable pressable-sm grid aspect-square select-none place-items-center rounded-card font-bold sm:rounded-tile",
                  "touch-manipulation max-lg:[&:nth-child(n+13)]:hidden",
                  lit
                    ? "bg-highlight text-highlight-foreground"
                    : "bg-panel-tile text-panel-foreground hover:bg-panel-line",
                  meta.glyph === "KSh"
                    ? "text-[clamp(18px,3vw,46px)]"
                    : "text-[clamp(26px,4.2vw,64px)]"
                )}
                data-currency={code}
                data-wall-tile
                key={`${code}-${i}`}
                onClick={() => choose(code, i)}
                onFocus={() => setFocusIndex(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") {
                    preview(code, { source: "wall", index: i });
                  }
                }}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                role="radio"
                style={
                  {
                    "--ripple": `${rippleDelay(i, from, columns)}ms`,
                  } as React.CSSProperties
                }
                tabIndex={i === focusIndex ? 0 : -1}
                type="button"
              >
                <span className="currency-glyph" data-glyph={code}>
                  {meta.glyph}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

"use client";

import {
  CURRENCIES,
  CURRENCY_SYMBOL,
  type Currency,
} from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { useLanding } from "@/components/landing/currency-context";
import { PaystackStatus } from "@/components/landing/paystack-status";
import { Segmented } from "@/components/landing/segmented";
import {
  THEME_OPTIONS,
  useThemeChoice,
} from "@/components/landing/theme-choice";
import { Panel } from "@/components/primitives";
import { gsap, MOTION_QUERIES, useGSAP } from "@/lib/gsap";
import { fileUrl, REPO } from "@/lib/landing";

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

/** Every project link on the page lives here, once. */
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Starter",
    links: [
      { label: "How billing works", href: "#webhooks" },
      { label: "Features", href: "#features" },
      { label: "Pricing page", href: "#pricing" },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "README", href: `${REPO}#readme`, external: true },
      {
        label: "Paystack setup",
        href: fileUrl("docs/paystack-setup.md"),
        external: true,
      },
      {
        label: "Contributing",
        href: fileUrl("CONTRIBUTING.md"),
        external: true,
      },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: REPO, external: true },
      { label: "Changelog", href: `${REPO}/commits/main`, external: true },
      { label: "Security", href: fileUrl("SECURITY.md"), external: true },
    ],
  },
];

/** Column headings and the first line of each column share one cap line. */
const HEADING =
  "font-semibold text-[13px] text-panel-muted [text-box:trim-both_cap_alphabetic]";

const link =
  "pressable pressable-lg inline-flex items-center gap-1 rounded-chip py-1.5 text-[15px] underline-offset-4 transition-colors duration-(--dur-fast) hover:underline active:text-panel-muted";

/**
 * Sets the wordmark's font size so it runs exactly from the content edge
 * (the first letter's ink) to the right edge (the tile). Everything inside
 * is in ems, so one measurement at any size gives the width per em. The CSS
 * value in globals.css is the server-side first guess.
 */
function useFillWidth(
  container: React.RefObject<HTMLDivElement | null>,
  text: React.RefObject<HTMLParagraphElement | null>
) {
  useEffect(() => {
    const box = container.current;
    const p = text.current;
    const tile = p?.querySelector<HTMLElement>(".footer-wordmark-tile");
    if (!(box && p && tile)) {
      return;
    }
    const fit = () => {
      p.style.fontSize = "";
      const size = Number.parseFloat(getComputedStyle(p).fontSize);
      // From the box's left edge (the first letter's ink, thanks to the
      // wordmark's negative margin) to the tile's right edge, per em.
      const width =
        (tile.getBoundingClientRect().right -
          box.getBoundingClientRect().left) /
        size;
      if (width > 0) {
        p.style.fontSize = `${box.clientWidth / width}px`;
      }
    };
    fit();
    document.fonts.ready.then(fit).catch(() => {});
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [container, text]);
}

function ThemeSwitch() {
  const { current, setTheme } = useThemeChoice();
  return (
    <div className="grid justify-items-start gap-3">
      <h3 className={HEADING} id="footer-theme">
        Theme
      </h3>
      <Segmented
        className="w-full max-w-[16.5rem]"
        label="Theme"
        onChange={setTheme}
        options={THEME_OPTIONS}
        tone="panel"
        value={current}
      />
    </div>
  );
}

/**
 * The site footer: the page's links (each exactly once), its one theme
 * control, live Paystack status and build info; then a wordmark that fills
 * the panel, its sunflower tile showing the currency chosen on the wall.
 */
export function SiteFooter({ build }: { build: BuildInfo }) {
  const { currency } = useLanding();
  const root = useRef<HTMLDivElement>(null);
  const wordmark = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLParagraphElement>(null);
  useFillWidth(wordmark, words);

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
    <footer className="landing-bleed mt-3 mb-[max(var(--edge),env(safe-area-inset-bottom))]">
      <Panel as="div" className="px-0 pt-8 pb-0 sm:px-0 sm:pt-10 sm:pb-0">
        <div className="landing-inner" ref={root}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 xl:gap-x-8">
            {COLUMNS.map((col) => (
              <nav
                aria-labelledby={`footer-${col.title.toLowerCase()}`}
                className="grid content-start justify-items-start gap-3"
                key={col.title}
              >
                <h3
                  className={HEADING}
                  id={`footer-${col.title.toLowerCase()}`}
                >
                  {col.title}
                </h3>
                <ul className="grid justify-items-start gap-0.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a className={link} href={l.href}>
                        {l.label}
                        {l.external ? (
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
            <ThemeSwitch />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-panel-line border-t pt-5 text-[13px] text-panel-muted lg:justify-between">
            <PaystackStatus className="max-w-[min(100%,30rem)]" />
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Version {build.version}</span>
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
                <a
                  className="pressable pressable-sm rounded-chip underline-offset-4 transition-colors duration-(--dur-fast) hover:text-panel-foreground hover:underline"
                  href={fileUrl("LICENSE")}
                >
                  MIT licence
                </a>
              </span>
            </p>
            <p>Not affiliated with Paystack.</p>
          </div>

          {/* The wordmark: sized by useFillWidth to run edge to edge. */}
          <div
            aria-hidden
            className="@container mt-[clamp(20px,3vw,48px)] overflow-hidden"
            data-wordmark
            ref={wordmark}
          >
            <p className="footer-wordmark" ref={words}>
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
                    <span className="currency-glyph" data-glyph={code}>
                      {CURRENCY_SYMBOL[code].trim()}
                    </span>
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

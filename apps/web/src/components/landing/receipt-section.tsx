"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import { GitForkIcon } from "lucide-react";
import { useRef } from "react";

import { NUMBER_TIMING } from "@/components/animated-number";
import { useLanding } from "@/components/landing/currency-context";
import { opticalEdge } from "@/components/landing/display";
import { InstallCommand } from "@/components/landing/start-command";
import { Panel } from "@/components/primitives";
import { gsap, MOTION_QUERIES, refreshAfterFonts, useGSAP } from "@/lib/gsap";
import { barcode, REPO } from "@/lib/landing";
import { formatMoney } from "@/lib/money";
import { moneyFlowProps } from "@/lib/money-flow";

const TITLE = "Nothing to pay. One command to start.";
/** The heading's two set lines; the text column takes their width. */
const TITLE_LINES = ["Nothing to pay.", "One command to start."];

/** What you "buy": every line is free, in whatever currency you chose. */
const LINE_ITEMS = [
  "1 × SaaS starter",
  "Organizations and roles",
  "Paystack billing, 5 currencies",
  "MIT licence",
];

/**
 * The closing call to action: the pitch on the left, and a receipt that
 * feeds out of a slot as you scroll to it (1:1 with the scrollbar; final
 * state under reduced motion and in the server HTML). The amount due is
 * zero in the page's currency, and you "pay" with the install command.
 */
export function ReceiptSection({ version }: { version: string }) {
  const { currency } = useLanding();
  const root = useRef<HTMLDivElement>(null);
  const bars = barcode(`turbo-start-paystack@${version}`);
  const zero = formatMoney(0, currency);

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
    <section
      aria-labelledby="start-title"
      className="landing-bleed scroll-mt-8"
      id="start"
    >
      <Panel
        as="div"
        className="overflow-hidden px-(--gut) pt-8 pb-3 sm:px-(--gut) sm:pt-12 sm:pb-5"
      >
        <div
          className="mx-auto grid w-full max-w-(--content-max) gap-10 min-[90rem]:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] min-[90rem]:items-center min-[90rem]:gap-12"
          ref={root}
        >
          {/* The column is as wide as the heading's longer line; the
              paragraph (w-0 min-w-full) wraps to that width rather than
              setting it. Centred on the receipt's box, which is its final
              printed height: the print-in only translates the paper. */}
          <div className="grid w-fit max-w-full justify-items-start gap-6">
            <h2
              className="display-l"
              id="start-title"
              style={opticalEdge(TITLE)}
            >
              {TITLE_LINES.map((line) => (
                <span className="block" key={line}>
                  {line}
                </span>
              ))}
            </h2>
            <p className="w-0 min-w-full text-pretty text-panel-muted">
              Clone it, run setup, and you have organizations, roles and
              Paystack billing on your machine, with a mock Paystack so you
              don&rsquo;t need an account yet. Node 22, pnpm and Postgres.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <a className={buttonVariants({ size: "lg" })} href={REPO}>
                <GitForkIcon aria-hidden />
                Open on GitHub
              </a>
              <a
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-panel-tile text-panel-foreground hover:bg-panel-line"
                )}
                href={`${REPO}#readme`}
              >
                Read the docs
              </a>
            </div>
          </div>

          <div className="w-full max-w-[37.5rem]" data-receipt-feeder>
            <div
              aria-hidden
              className="relative z-10 h-2.5 rounded-chip bg-[var(--forest-950)] shadow-[inset_0_2px_0_oklch(0_0_0/0.35)]"
            />
            {/* The clip: the paper slides out from under the slot. */}
            <div className="-mt-[5px] overflow-hidden px-3 pb-4">
              <div className="receipt-paper relative" data-receipt-paper>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-lg tracking-[-0.01em]">
                    Turbo Start Paystack
                  </p>
                  <p className="text-[13px] text-[var(--receipt-muted)]">
                    v{version}
                  </p>
                </div>
                <hr className="receipt-rule" />
                <ul className="grid">
                  {LINE_ITEMS.map((label) => (
                    <li className="receipt-line" key={label}>
                      <span className="shrink-0 whitespace-nowrap font-medium">
                        {label}
                      </span>
                      <span aria-hidden className="receipt-leader" />
                      <span className="shrink-0 text-[13px] text-[var(--receipt-muted)] tabular-nums">
                        {zero}
                      </span>
                    </li>
                  ))}
                </ul>
                <hr className="receipt-rule" />
                <div className="flex items-end justify-between gap-4">
                  <span className="text-[13px] text-[var(--receipt-muted)]">
                    Amount due
                  </span>
                  <span
                    className="font-semibold text-[36px] leading-none tracking-[-0.03em]"
                    data-amount-due
                  >
                    <span className="sr-only">{zero}</span>
                    <NumberFlow
                      aria-hidden
                      className="tabular-nums"
                      {...moneyFlowProps(0, currency)}
                      {...NUMBER_TIMING.money}
                    />
                  </span>
                </div>
                <hr className="receipt-rule" />
                <InstallCommand />
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
        </div>
      </Panel>
    </section>
  );
}

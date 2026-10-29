"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@workspace/tailwind-config/utils";
import { CircleXIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { NUMBER_TIMING } from "@/components/animated-number";
import { opticalEdge } from "@/components/landing/display";
import { type OptionProps, PathChip } from "@/components/not-found/parts";
import { gsap, MOTION_QUERIES, useGSAP } from "@/lib/gsap";
import { barcode } from "@/lib/landing";
import { formatMoney } from "@/lib/money";
import { moneyFlowProps } from "@/lib/money-flow";
import { referenceFor } from "@/lib/not-found";

const TITLE = "This page was declined.";

/** The attempted amount the receipt rolls down from: 404.00. */
const ATTEMPTED = 40_400;

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="receipt-line min-w-0">
      <span className="shrink-0 whitespace-nowrap text-[var(--receipt-muted)]">
        {label}
      </span>
      <span aria-hidden className="receipt-leader" />
      <span className="min-w-0 truncate text-right font-medium">
        {children}
      </span>
    </li>
  );
}

/**
 * Option B: the request as a Paystack transaction that the gateway turned
 * down. The receipt feeds out of a slot, nudges side to side like a
 * terminal saying no, and the amount rolls from 404.00 to zero. Retry goes
 * home. The server HTML is the final state (zero due, receipt in place).
 */
export function Declined({ path, shown, currency }: OptionProps) {
  const root = useRef<HTMLDivElement>(null);
  const [due, setDue] = useState(0);
  const bars = barcode(path, 44);
  const reference = referenceFor(path);
  const zero = formatMoney(0, currency);

  useGSAP(
    () => {
      const box = root.current;
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        box?.setAttribute("data-ready", "");
        if (!ctx.conditions?.motion) {
          return;
        }
        // Behind the clip, the amount rolls up to the attempt first, so it
        // can fall to zero once the receipt is out.
        setDue(ATTEMPTED);
        gsap
          .timeline({ delay: 0.15 })
          .fromTo(
            "[data-receipt-paper]",
            { yPercent: -101 },
            { yPercent: 0, duration: 1.05, ease: "power3.out" }
          )
          .to("[data-receipt-paper]", {
            keyframes: { x: [0, -7, 6, -4, 2, 0] },
            duration: 0.42,
            ease: "none",
          })
          .call(() => setDue(0), [], "-=0.2");
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div
      className="declined grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-16"
      ref={root}
    >
      <div className="grid content-center justify-items-start gap-6">
        <h1 className="display-l max-w-[12ch]" style={opticalEdge(TITLE)}>
          {TITLE}
        </h1>
        <p className="max-w-[30rem] text-pretty text-[17px] text-panel-muted">
          We tried to open <PathChip path={path} shown={shown} /> and the
          gateway answered 404: there is no page here. Nothing was charged.
        </p>
      </div>

      <div className="min-w-0">
        <div
          aria-hidden
          className="relative z-10 h-2.5 rounded-chip bg-[var(--forest-950)] shadow-[inset_0_2px_0_oklch(0_0_0/0.35)]"
        />
        <div className="-mt-[5px] overflow-hidden px-3 pb-4">
          <div className="receipt-paper relative" data-receipt-paper>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[15px] tracking-[-0.01em] sm:text-lg">
                Turbo Start Paystack
              </p>
              <p className="inline-flex shrink-0 items-center gap-1.5 rounded-chip bg-[var(--receipt-danger-bg)] px-2 py-1 font-semibold text-[12.5px] text-[var(--receipt-danger)]">
                <CircleXIcon aria-hidden className="size-3.5" />
                Declined
              </p>
            </div>
            <hr className="receipt-rule" />
            <ul className="grid">
              <Line label="Page">
                <span className="font-mono text-[13px]" title={path}>
                  {shown}
                </span>
              </Line>
              <Line label="Reference">
                <span className="font-mono text-[13px]">{reference}</span>
              </Line>
              <Line label="Date">
                <span className="tabular-nums" suppressHydrationWarning>
                  {stamp.format(new Date())} UTC
                </span>
              </Line>
              <Line label="Channel">Link</Line>
              <Line label="Response">
                <span className="text-[var(--receipt-danger)]">
                  404 Page not found
                </span>
              </Line>
            </ul>
            <hr className="receipt-rule" />
            <div className="flex items-end justify-between gap-4">
              <span className="whitespace-nowrap text-[13px] text-[var(--receipt-muted)]">
                Amount due
              </span>
              <span className="font-semibold text-[clamp(26px,8.5vw,36px)] leading-none tracking-[-0.03em]">
                <span className="sr-only">{zero}</span>
                <NumberFlow
                  aria-hidden
                  className="tabular-nums"
                  {...moneyFlowProps(due, currency)}
                  {...NUMBER_TIMING.money}
                />
              </span>
            </div>
            <hr className="receipt-rule" />
            <Link
              className={cn(
                "pressable flex h-12 w-full items-center justify-center gap-2 rounded-control font-semibold text-[15px]",
                "bg-panel text-panel-foreground hover:bg-panel-tile"
              )}
              href="/"
            >
              <RotateCwIcon aria-hidden className="size-4" />
              Retry
            </Link>
            <p className="mt-2 text-center text-[12.5px] text-[var(--receipt-muted)]">
              Retry starts again from the home page.
            </p>
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
              No money moved. Keep this for your records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

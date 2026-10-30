"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@workspace/tailwind-config/utils";
import {
  BadgeCheckIcon,
  DatabaseIcon,
  type LucideIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SendIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { useLanding } from "@/components/landing/currency-context";
import type { PriceTable } from "@/components/landing/types";
import { Panel } from "@/components/primitives";
import { gsap, MOTION_QUERIES, useGSAP } from "@/lib/gsap";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/money";

/** Two-digit step number: 01, 02, 03. */
const nth = (i: number) => String(i + 1).padStart(2, "0");

type Side = {
  plan: "Free" | "Pro";
  paid: boolean;
  /** Subunits collected so far. */
  collected: number;
};

/**
 * What each app believes after `step` requests (0 to 3). Opens on 3, the
 * outcome; the timeline moves it as packets land.
 */
function useWebhookRun(prices: PriceTable) {
  const { currency } = useLanding();
  const [step, seek] = useState(3);
  const amount = prices[currency].pro.monthly;
  const price = formatMoney(amount, currency).replace(/\.00$/, "");
  const browser: Side = {
    plan: step >= 1 ? "Pro" : "Free",
    paid: step >= 2,
    collected: step >= 3 ? amount * 2 : step >= 2 ? amount : 0,
  };
  const signed: Side = {
    plan: step >= 2 ? "Pro" : "Free",
    paid: step >= 2,
    collected: step >= 2 ? amount : 0,
  };
  return {
    step,
    seek,
    amount,
    price,
    symbol: CURRENCY_SYMBOL[currency].trim(),
    requests: ["POST /api/plan", "charge.success", "charge.success"],
    browser,
    signed,
  };
}

const ODOMETER_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * A total that rolls like an odometer, every digit on one 520ms curve.
 * NumberFlow skips the first render and stands still under reduced motion;
 * screen readers get the sr-only text.
 */
function Odometer({ subunits, symbol }: { subunits: number; symbol: string }) {
  const value = subunits / 100;
  return (
    <span className="inline-block whitespace-nowrap">
      <span className="sr-only">
        {symbol}
        {new Intl.NumberFormat("en").format(value)}
      </span>
      <NumberFlow
        aria-hidden
        className="tabular-nums"
        format={{ maximumFractionDigits: 0 }}
        locales="en"
        opacityTiming={{ duration: 260, easing: "ease-out" }}
        prefix={symbol}
        spinTiming={{ duration: 520, easing: ODOMETER_EASE }}
        transformTiming={{ duration: 520, easing: ODOMETER_EASE }}
        value={value}
      />
    </span>
  );
}

const MONO = "font-mono text-[13px] leading-5 tracking-[0.02em]";

/* ---------------------------------------------------------- webhooks */

/** Station centres along the track, in % of its width. */
const AT = { sender: 10, server: 30, signature: 50, store: 70, plan: 90 };
const STATIONS: {
  key: keyof typeof AT;
  label: string;
  icon: LucideIcon;
  off?: LucideIcon;
}[] = [
  { key: "sender", label: "Sender", icon: SendIcon },
  { key: "server", label: "Your server", icon: ServerIcon },
  {
    key: "signature",
    label: "Signature check",
    icon: ShieldCheckIcon,
    off: ShieldOffIcon,
  },
  { key: "store", label: "Stored once", icon: DatabaseIcon },
  { key: "plan", label: "Plan", icon: BadgeCheckIcon },
];

type Packet = {
  label: string;
  /** Where it stops, and whether it is absorbed (reaches the plan) there. */
  to: number;
  stamp?: { text: string; tone: "bad" | "warn" };
};

/** Seconds per request on the timeline, and the travel inside it. */
const BEAT = 2;
const TRAVEL = 1.1;

function Lane({
  name,
  caption,
  checks,
  packets,
  lane,
  total,
  totalBad,
  note,
}: {
  name: string;
  caption: string;
  checks: boolean;
  packets: Packet[];
  lane: string;
  total: ReactNode;
  totalBad: boolean;
  note: string;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="grid gap-1">
          <h3 className="font-medium text-[20px] tracking-[-0.02em]">{name}</h3>
          <p className="text-[16px] text-panel-muted">{caption}</p>
        </div>
        <div className="grid justify-items-end">
          <span
            className={cn(
              "font-medium text-[32px] leading-none tracking-[-0.03em] sm:text-[40px]",
              totalBad && "text-[oklch(0.78_0.14_25)]"
            )}
          >
            {total}
          </span>
          <span className={cn(MONO, "mt-2 text-panel-muted uppercase")}>
            {note}
          </span>
        </div>
      </div>
      <div className="relative overflow-x-clip">
        {/* The wire, first station to last. */}
        <span
          aria-hidden
          className="absolute top-[19px] right-[10%] left-[10%] h-px bg-panel-line"
        />
        <ol className="relative grid grid-cols-5">
          {STATIONS.map((s) => {
            const missing =
              !checks && (s.key === "signature" || s.key === "store");
            const Icon = missing && s.off ? s.off : s.icon;
            return (
              <li
                className="grid justify-items-center gap-3 text-center"
                key={s.key}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-10 place-items-center rounded-control",
                    missing
                      ? "border border-panel-line border-dashed bg-panel text-panel-muted/60"
                      : "bg-panel-tile text-panel-muted shadow-[inset_0_0_0_1px_var(--panel-line)]"
                  )}
                >
                  {missing && !s.off ? null : <Icon className="size-[18px]" />}
                </span>
                <span
                  className={cn(
                    MONO,
                    "max-w-[12ch] text-balance uppercase max-sm:sr-only",
                    missing
                      ? "text-panel-muted/70 line-through"
                      : "text-panel-muted"
                  )}
                >
                  {s.label}
                  {missing ? (
                    <span className="sr-only"> (not checked)</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
        {/* Packets: each rides a full-width carrier, so xPercent is % of track. */}
        {packets.map((p, i) => {
          const absorbed = p.to === AT.plan;
          return (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-[8px]"
              data-carrier={`${lane}-${i}`}
              key={p.label}
              style={{
                transform: `translateX(${p.to}%)`,
                opacity: absorbed ? 0 : 1,
              }}
            >
              <span className="relative inline-flex h-6 -translate-x-1/2 items-center rounded-chip bg-highlight px-2 font-mono font-semibold text-[13px] text-highlight-foreground shadow-[0_0_0_3px_var(--panel)]">
                {nth(i)}
                <span className="max-sm:hidden">&nbsp;{p.label}</span>
                {p.stamp ? (
                  <span
                    className={cn(
                      "absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-chip px-1 py-0.5 font-mono font-semibold text-[11px] tracking-[0.02em] sm:px-1.5 sm:text-[12px] sm:tracking-[0.04em]",
                      p.stamp.tone === "bad"
                        ? "bg-[oklch(0.62_0.2_27)] text-white"
                        : "bg-panel-foreground text-panel"
                    )}
                    data-stamp={`${lane}-${i}`}
                  >
                    {p.stamp.text}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The webhooks proof: one stage, two lanes, and the same three requests
 * travelling through both as packets. In the starter's lane the forged one
 * stops at the signature check and the retry at the event store. Pause,
 * Replay and the scrubber drive one GSAP timeline (transforms and opacity
 * only); the totals and the steps list follow it, and only change when a
 * packet lands. The server sends the final frame, so without JavaScript it
 * reads finished, with the steps in order below it; the controls hide.
 */
export function WebhookReplay({ prices }: { prices: PriceTable }) {
  const run = useWebhookRun(prices);
  const { step, seek, requests } = run;
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const last = useRef(3);
  const [playing, setPlaying] = useState(false);

  const trusting: Packet[] = [
    { label: "forged", to: AT.plan },
    { label: "charge", to: AT.plan },
    { label: "retry", to: AT.plan },
  ];
  const signedPackets: Packet[] = [
    {
      label: "forged",
      to: AT.signature,
      stamp: { text: "BLOCKED", tone: "bad" },
    },
    { label: "charge", to: AT.plan },
    {
      label: "retry",
      to: AT.store,
      stamp: { text: "DUPLICATE", tone: "warn" },
    },
  ];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        const travel = ctx.conditions?.reduce ? 0.001 : TRAVEL;
        const t = gsap.timeline({
          paused: true,
          onUpdate: () => {
            const time = t.time();
            const s = Math.min(
              3,
              Math.floor((time + BEAT - TRAVEL - 0.2) / BEAT)
            );
            const n = Math.max(0, s);
            if (n !== last.current) {
              last.current = n;
              seek(n);
            }
            if (scrub.current) {
              scrub.current.value = String(Math.round(t.progress() * 1000));
            }
          },
          onComplete: () => setPlaying(false),
        });
        const lanes = [
          ["trust", trusting],
          ["signed", signedPackets],
        ] as const;
        for (const [lane, packets] of lanes) {
          packets.forEach((p, i) => {
            const el = `[data-carrier="${lane}-${i}"]`;
            const at = i * BEAT;
            // Take over the server's inline translate as a percentage.
            gsap.set(el, { x: 0, xPercent: p.to });
            t.fromTo(
              el,
              { xPercent: AT.sender, opacity: 0 },
              {
                opacity: 1,
                duration: 0.2,
                ease: "none",
                immediateRender: false,
              },
              at
            );
            t.fromTo(
              el,
              { xPercent: AT.sender },
              {
                xPercent: p.to,
                duration: travel,
                ease: "power2.inOut",
                immediateRender: false,
              },
              at + 0.2
            );
            if (p.stamp) {
              t.fromTo(
                `[data-stamp="${lane}-${i}"]`,
                { opacity: 0, scale: 0.8 },
                {
                  opacity: 1,
                  scale: 1,
                  duration: 0.2,
                  ease: "back.out(2)",
                  immediateRender: false,
                },
                at + 0.2 + travel
              );
            }
            if (p.to === AT.plan) {
              t.to(
                el,
                { opacity: 0, duration: 0.2, ease: "none" },
                at + 0.2 + travel
              );
            }
          });
        }
        t.progress(1);
        tl.current = t;
        return () => {
          t.kill();
          tl.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  const replay = () => {
    tl.current?.restart();
    setPlaying(true);
  };
  const toggle = () => {
    const t = tl.current;
    if (!t) {
      return;
    }
    if (t.progress() >= 1) {
      replay();
    } else if (t.paused()) {
      t.play();
      setPlaying(true);
    } else {
      t.pause();
      setPlaying(false);
    }
  };

  const steps = [
    {
      what: 'The browser posts {"plan":"pro"}.',
      trust: "The trusting app sets Pro, nothing paid.",
      signed: "Blocked at the signature check.",
    },
    {
      what: `Paystack sends charge.success for ${run.price}.`,
      trust: `Counted ${run.price}.`,
      signed: "Signature verified. Pro is active.",
    },
    {
      what: "Paystack retries the same event.",
      trust: `Counted ${run.price} again.`,
      signed: "Already stored. Skipped.",
    },
  ];

  return (
    <Panel as="div" className="grid gap-10 p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4 no-js:hidden">
        <span className={cn(MONO, "text-panel-muted uppercase")}>
          Three requests · two apps
        </span>
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <button
            aria-label={playing ? "Pause" : "Play"}
            className="pressable inline-flex size-10 items-center justify-center rounded-control bg-panel-tile text-panel-foreground hover:bg-panel-line"
            onClick={toggle}
            type="button"
          >
            {playing ? (
              <PauseIcon aria-hidden className="size-4" />
            ) : (
              <PlayIcon aria-hidden className="size-4" />
            )}
          </button>
          <button
            className="pressable inline-flex h-10 items-center gap-2 rounded-control bg-panel-foreground px-4 font-semibold text-[15px] text-panel hover:opacity-90"
            onClick={replay}
            type="button"
          >
            <RotateCcwIcon aria-hidden className="size-4" />
            Replay
          </button>
          <input
            aria-label="Scrub through the requests"
            className="h-10 w-full min-w-24 cursor-pointer accent-[var(--highlight)] sm:w-56"
            defaultValue={1000}
            max={1000}
            min={0}
            onInput={(e) => {
              const t = tl.current;
              if (t) {
                t.pause();
                setPlaying(false);
                t.progress(Number(e.currentTarget.value) / 1000);
              }
            }}
            ref={scrub}
            type="range"
          />
        </div>
      </div>

      <div className="grid gap-12" ref={root}>
        <Lane
          caption="The plan is whatever the last request said."
          checks={false}
          lane="trust"
          name="Trusts the browser"
          note={
            run.browser.plan === "Pro" && !run.browser.paid
              ? "Pro, unpaid"
              : run.browser.collected > run.amount
                ? "Pro gifted · counted twice"
                : run.browser.plan
          }
          packets={trusting}
          total={
            <Odometer subunits={run.browser.collected} symbol={run.symbol} />
          }
          totalBad={run.browser.collected > run.amount}
        />
        <Lane
          caption="Only signed events from Paystack, each stored once."
          checks
          lane="signed"
          name="Trusts the signature"
          note={run.signed.plan === "Pro" ? "Pro · counted once" : "Free"}
          packets={signedPackets}
          total={
            <Odometer subunits={run.signed.collected} symbol={run.symbol} />
          }
          totalBad={false}
        />
      </div>

      {/* The annotations: the steps in order, the current one lit. */}
      <ol
        aria-live="polite"
        className="grid gap-6 border-panel-line border-t pt-8 md:grid-cols-3 md:gap-8"
      >
        {steps.map((s, i) => (
          <li
            className={cn(
              "grid content-start gap-2 transition-opacity duration-(--dur-base)",
              playing && i !== step - 1 && i >= step ? "opacity-40" : ""
            )}
            key={`step-${nth(i)}`}
          >
            <span className={cn(MONO, "text-panel-muted uppercase")}>
              {nth(i)} · {requests[i]}
            </span>
            <p className="text-[18px] leading-[1.45]">{s.what}</p>
            <p className="text-[16px] leading-[1.45] text-panel-muted">
              <span className="text-[oklch(0.78_0.14_25)]">{s.trust}</span>{" "}
              <span className="text-success">{s.signed}</span>
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

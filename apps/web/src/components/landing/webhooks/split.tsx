"use client";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CopyCheckIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import { useLanding } from "@/components/landing/currency-context";
import type { PriceTable } from "@/components/landing/types";
import { Panel } from "@/components/primitives";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/money";

const STEP_MS = 1000;

type Tone = "bad" | "good" | "quiet";
type Verdict = { text: string; tone: Tone };

type Side = {
  plan: "Free" | "Pro";
  paid: boolean;
  /** Subunits collected so far. */
  collected: number;
  verdicts: Verdict[];
};

/** What each side looks like after `step` events (0 to 3). */
function trustingBrowser(step: number, amount: number, price: string): Side {
  const v: Verdict[] = [];
  if (step >= 1) v.push({ text: "Plan set to Pro, nothing paid", tone: "bad" });
  if (step >= 2) v.push({ text: `${price} counted`, tone: "quiet" });
  if (step >= 3) v.push({ text: `${price} counted again`, tone: "bad" });
  return {
    plan: step >= 1 ? "Pro" : "Free",
    paid: step >= 2,
    collected: step >= 3 ? amount * 2 : step >= 2 ? amount : 0,
    verdicts: v,
  };
}
function trustingSigned(step: number, amount: number): Side {
  const v: Verdict[] = [];
  if (step >= 1) v.push({ text: "Rejected: unsigned", tone: "good" });
  if (step >= 2) v.push({ text: "Verified, Pro active", tone: "good" });
  if (step >= 3) v.push({ text: "Duplicate, stored once", tone: "good" });
  return {
    plan: step >= 2 ? "Pro" : "Free",
    paid: step >= 2,
    collected: step >= 2 ? amount : 0,
    verdicts: v,
  };
}

const TONE = {
  bad: { variant: "destructive", icon: TriangleAlertIcon },
  good: { variant: "success", icon: ShieldCheckIcon },
  quiet: { variant: "quiet", icon: CopyCheckIcon },
} as const;

function VerdictBadge({ verdict }: { verdict: Verdict | undefined }) {
  if (!verdict) {
    return <span className="text-muted-foreground text-xs">waiting</span>;
  }
  const t = TONE[verdict.tone];
  return (
    <Badge
      className="animate-swap h-auto min-h-6 max-w-full shrink whitespace-normal py-1 text-left leading-tight"
      variant={t.variant}
    >
      <t.icon aria-hidden />
      {verdict.text}
    </Badge>
  );
}

function Totals({
  side,
  amount,
  symbol,
}: {
  side: Side;
  amount: number;
  symbol: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-card bg-secondary p-4">
      <div className="grid gap-1">
        <span className="text-muted-foreground text-xs">Plan</span>
        <span className="flex items-center gap-2 font-semibold">
          {side.plan}
          {side.plan === "Pro" && !side.paid ? (
            <Badge variant="warning">Unpaid</Badge>
          ) : null}
        </span>
      </div>
      <div className="grid gap-1">
        <span className="text-muted-foreground text-xs">Collected</span>
        <AnimatedNumber
          className={cn(
            "font-semibold text-lg",
            side.collected > amount && "text-destructive"
          )}
          format={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
          kind="money"
          prefix={symbol}
          value={side.collected / 100}
        />
      </div>
    </div>
  );
}

function Outcome({ trusted, text }: { trusted: boolean; text: string }) {
  return (
    <p
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-card px-3 py-2.5 font-medium text-sm",
        trusted
          ? "bg-success-bg text-success"
          : "bg-destructive-bg text-destructive"
      )}
      data-verdict={trusted ? "signed" : "browser"}
    >
      {trusted ? (
        <ShieldCheckIcon aria-hidden className="size-4 shrink-0" />
      ) : (
        <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
      )}
      {text}
    </p>
  );
}

/**
 * "Before and after": the same three requests sent to an app that trusts the
 * browser and to the starter. It opens on the outcome (free Pro and a double
 * count on the left, one correct charge on the right); Replay plays the
 * requests one by one. Phones get one list with both answers per request.
 */
export function WebhookSplit({ prices }: { prices: PriceTable }) {
  const { currency } = useLanding();
  const [step, setStep] = useState(3);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const amount = prices[currency].pro.monthly;
  const price = formatMoney(amount, currency).replace(/\.00$/, "");
  const symbol = CURRENCY_SYMBOL[currency].trim();
  const steps = [
    { event: "POST /api/plan", detail: '{"plan":"pro"} from the browser' },
    {
      event: "charge.success",
      detail: `${formatMoney(amount, currency)}, ref T7Q2K9X4`,
    },
    { event: "charge.success", detail: "Paystack retries T7Q2K9X4" },
  ];
  const browser = trustingBrowser(step, amount, price);
  const signed = trustingSigned(step, amount);
  const done = step === steps.length;
  const outcome = {
    browser: `Gave away Pro, then counted ${price} twice.`,
    signed: "One paid month, counted once.",
  };

  const play = () => {
    clearTimeout(timer.current);
    setStep(0);
    setPlaying(true);
    const tick = (n: number) => {
      timer.current = setTimeout(() => {
        setStep(n);
        if (n < steps.length) {
          tick(n + 1);
        } else {
          setPlaying(false);
        }
      }, STEP_MS);
    };
    tick(1);
  };

  // Requests not sent yet stay readable; only their colour steps back.
  const rowTone = (i: number) => (i < step ? "" : "text-muted-foreground");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-secondary p-3 pl-5">
        <p aria-live="polite" className="text-sm">
          {playing
            ? `Sending ${steps[step]?.event ?? steps[steps.length - 1]?.event}…`
            : `Three requests: a forged upgrade, a real payment, then Paystack retrying it. One app gave away Pro and counted ${price} twice.`}
        </p>
        <button
          className="pressable inline-flex h-11 items-center gap-2 rounded-control bg-primary px-4 font-semibold text-[15px] text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          disabled={playing}
          onClick={play}
          type="button"
        >
          {done ? (
            <RotateCcwIcon aria-hidden className="size-4" />
          ) : (
            <PlayIcon aria-hidden className="size-4" />
          )}
          {playing ? "Playing" : "Replay the requests"}
        </button>
      </div>

      {/* Tablet and up: the two apps side by side. */}
      <div className="grid gap-4 max-md:hidden md:grid-cols-2">
        {(
          [
            {
              key: "browser",
              title: "Trusting the browser",
              caption: "The plan is whatever the last request said.",
              side: browser,
              trusted: false,
            },
            {
              key: "signed",
              title: "Trusting signed events",
              caption: "Only signed events from Paystack, each stored once.",
              side: signed,
              trusted: true,
            },
          ] as const
        ).map((col) => {
          const Wrap = col.trusted ? Panel : "div";
          return (
            <Wrap
              className={cn(
                "flex flex-col gap-5 rounded-tile p-5 sm:p-6",
                !col.trusted && "bg-card shadow-tile"
              )}
              key={col.key}
            >
              <div className="grid gap-1.5">
                <h3 className="font-semibold text-xl tracking-[-0.02em] [text-box:trim-both_cap_alphabetic]">
                  {col.title}
                </h3>
                <p className="text-muted-foreground text-sm">{col.caption}</p>
              </div>
              <Totals amount={amount} side={col.side} symbol={symbol} />
              <ol className="grid auto-rows-[2.75rem] gap-2">
                {steps.map((s, i) => (
                  <li
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-card px-3 text-sm transition-colors duration-(--dur-base)",
                      rowTone(i)
                    )}
                    key={`${s.event}-${i}`}
                  >
                    <code className="truncate font-mono text-[13px]">
                      {s.event}
                    </code>
                    <VerdictBadge verdict={col.side.verdicts[i]} />
                  </li>
                ))}
              </ol>
              {/* Space is reserved, so the outcome only fades in. */}
              <div
                className={cn(
                  "mt-auto transition-opacity duration-(--dur-base)",
                  !done && "opacity-0"
                )}
              >
                <Outcome
                  text={col.trusted ? outcome.signed : outcome.browser}
                  trusted={col.trusted}
                />
              </div>
            </Wrap>
          );
        })}
      </div>

      {/* Phones: one list, both answers under each request. */}
      <div className="grid gap-3 md:hidden" data-webhooks-compact>
        <ol className="grid gap-2">
          {steps.map((s, i) => (
            <li
              className={cn(
                "grid gap-2.5 rounded-card bg-card p-4 shadow-tile transition-colors duration-(--dur-base)",
                rowTone(i)
              )}
              key={`${s.event}-${i}`}
            >
              <div className="grid gap-0.5">
                <code className="font-mono text-[13px]">{s.event}</code>
                <span className="text-muted-foreground text-xs">
                  {s.detail}
                </span>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Browser</dt>
                <dd className="min-w-0">
                  <VerdictBadge verdict={browser.verdicts[i]} />
                </dd>
                <dt className="text-muted-foreground">Signed</dt>
                <dd className="min-w-0">
                  <VerdictBadge verdict={signed.verdicts[i]} />
                </dd>
              </dl>
            </li>
          ))}
        </ol>
        <div
          className={cn(
            "grid gap-2 transition-opacity duration-(--dur-base)",
            !done && "opacity-0"
          )}
        >
          <Outcome text={outcome.browser} trusted={false} />
          <Outcome text={outcome.signed} trusted />
        </div>
      </div>
    </div>
  );
}

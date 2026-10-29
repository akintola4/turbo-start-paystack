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
import { Panel } from "@/components/primitives";

/** The scenario both sides receive, in order. */
const STEPS = [
  { event: "POST /api/plan", detail: '{"plan":"pro"} from the browser' },
  { event: "charge.success", detail: "₦30,000.00, ref T7Q2K9X4" },
  { event: "charge.success", detail: "Paystack retries T7Q2K9X4" },
] as const;

type Side = {
  plan: "Free" | "Pro";
  paid: boolean;
  collected: number;
  verdicts: { text: string; tone: "bad" | "good" | "quiet" }[];
};

/** What each side looks like after `step` events (0 to 3). */
function naive(step: number): Side {
  const v: Side["verdicts"] = [];
  if (step >= 1) v.push({ text: "Plan set to Pro, nothing paid", tone: "bad" });
  if (step >= 2) v.push({ text: "₦30,000 counted", tone: "quiet" });
  if (step >= 3) v.push({ text: "₦30,000 counted again", tone: "bad" });
  return {
    plan: step >= 1 ? "Pro" : "Free",
    paid: step >= 2,
    collected: step >= 3 ? 60_000 : step >= 2 ? 30_000 : 0,
    verdicts: v,
  };
}
function signed(step: number): Side {
  const v: Side["verdicts"] = [];
  if (step >= 1) v.push({ text: "Rejected: unsigned", tone: "good" });
  if (step >= 2) v.push({ text: "Verified, Pro active", tone: "good" });
  if (step >= 3) v.push({ text: "Duplicate, stored once", tone: "good" });
  return {
    plan: step >= 2 ? "Pro" : "Free",
    paid: step >= 2,
    collected: step >= 2 ? 30_000 : 0,
    verdicts: v,
  };
}

const TONE = {
  bad: { variant: "destructive", icon: TriangleAlertIcon },
  good: { variant: "success", icon: ShieldCheckIcon },
  quiet: { variant: "quiet", icon: CopyCheckIcon },
} as const;

function Column({
  title,
  caption,
  side,
  step,
  trusted,
}: {
  title: string;
  caption: string;
  side: Side;
  step: number;
  trusted: boolean;
}) {
  const Wrap = trusted ? Panel : "div";
  return (
    <Wrap
      className={cn(
        "flex flex-col gap-5 rounded-tile p-5 sm:p-6",
        !trusted && "bg-card shadow-tile"
      )}
    >
      <div className="grid gap-1.5">
        <h3 className="font-semibold text-xl tracking-[-0.02em] [text-box:trim-both_cap_alphabetic]">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm">{caption}</p>
      </div>
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
              side.collected > 30_000 && "text-destructive"
            )}
            format={{ minimumFractionDigits: 0 }}
            kind="money"
            prefix="₦"
            value={side.collected}
          />
        </div>
      </div>
      <ol
        aria-live="polite"
        className="grid gap-2"
        style={{ gridTemplateRows: "repeat(3, 2.75rem)" }}
      >
        {STEPS.map((s, i) => {
          const v = side.verdicts[i];
          const t = v ? TONE[v.tone] : null;
          return (
            <li
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-card px-3 text-sm transition-opacity duration-(--dur-base)",
                i < step ? "opacity-100" : "opacity-30"
              )}
              key={`${s.event}-${i}`}
            >
              <code className="truncate font-mono text-[13px]">{s.event}</code>
              {v && t ? (
                <Badge className="animate-swap" variant={t.variant}>
                  <t.icon aria-hidden />
                  {v.text}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">waiting</span>
              )}
            </li>
          );
        })}
      </ol>
      {/* The verdict: space is reserved from the start, so it only fades in. */}
      <p
        aria-hidden={step < STEPS.length}
        className={cn(
          "mt-auto flex min-h-11 items-center gap-2 rounded-card px-3 py-2.5 font-medium text-sm transition-opacity duration-(--dur-base) motion-reduce:transition-none",
          trusted
            ? "bg-success-bg text-success"
            : "bg-destructive-bg text-destructive",
          step < STEPS.length && "opacity-0"
        )}
        data-verdict={trusted ? "signed" : "browser"}
      >
        {trusted ? (
          <ShieldCheckIcon aria-hidden className="size-4 shrink-0" />
        ) : (
          <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
        )}
        {trusted
          ? "One paid month, counted once."
          : "Gave away Pro, then counted ₦30,000 twice."}
      </p>
    </Wrap>
  );
}

/**
 * Option C, "Before and after": the same three requests sent to an app that
 * trusts the browser and to the starter. Play runs them one by one; the left
 * ends with free Pro and a double-counted charge, the right stays correct.
 */
export function WebhookSplit() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const play = () => {
    clearTimeout(timer.current);
    setStep(0);
    setPlaying(true);
    const tick = (n: number) => {
      timer.current = setTimeout(() => {
        setStep(n);
        if (n < STEPS.length) {
          tick(n + 1);
        } else {
          setPlaying(false);
        }
      }, 1000);
    };
    tick(1);
  };

  const done = step === STEPS.length;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-secondary p-3 pl-5">
        <p aria-live="polite" className="text-sm">
          {step === 0
            ? "Three requests: a forged upgrade, a real payment, then Paystack retrying it."
            : done
              ? "Same requests. One app gave away Pro and counted ₦30,000 twice."
              : `Sending ${STEPS[step - 1]?.event ?? ""}…`}
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
          {done ? "Replay" : "Play the scenario"}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <Column
          caption="The plan is whatever the last request said."
          side={naive(step)}
          step={step}
          title="Trusting the browser"
          trusted={false}
        />
        <Column
          caption="Only signed events from Paystack, each stored once."
          side={signed(step)}
          step={step}
          title="Trusting signed events"
          trusted
        />
      </div>
    </div>
  );
}

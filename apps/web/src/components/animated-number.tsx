"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@workspace/tailwind-config/utils";

/**
 * Number motion tokens (docs/design-system.md §5; also in globals.css as
 * --motion-number-*). The roll is slow enough to read and decelerates
 * smoothly; width moves on the same curve so both finish together. Money
 * uses the longer timings, live counts the shorter ones. NumberFlow skips
 * the first render and turns off under prefers-reduced-motion.
 */
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
export const NUMBER_TIMING = {
  money: {
    spinTiming: { duration: 850, easing: EXPO_OUT },
    transformTiming: { duration: 700, easing: EXPO_OUT },
    opacityTiming: { duration: 340, easing: "ease-out" },
  },
  count: {
    spinTiming: { duration: 750, easing: EXPO_OUT },
    transformTiming: { duration: 600, easing: EXPO_OUT },
    opacityTiming: { duration: 300, easing: "ease-out" },
  },
} as const;

/**
 * NumberFlow with the shared timings. The visual element is aria-hidden and
 * an sr-only copy carries the accessible text, so screen readers never get
 * NumberFlow's injected styles. `label` overrides that text (e.g. "30,000
 * naira per month").
 */
export function AnimatedNumber({
  value,
  format,
  prefix,
  suffix,
  label,
  className,
  kind = "count",
}: {
  value: number;
  format?: Format;
  prefix?: string;
  suffix?: string;
  label?: string;
  className?: string;
  /** "money" uses the longer roll; "count" the shorter one. */
  kind?: keyof typeof NUMBER_TIMING;
}) {
  const text =
    label ??
    `${prefix ?? ""}${new Intl.NumberFormat("en", format).format(value)}${suffix ?? ""}`;
  return (
    <span className={cn("inline-block whitespace-nowrap", className)}>
      <span className="sr-only">{text}</span>
      <NumberFlow
        aria-hidden
        className="tabular-nums"
        format={format}
        locales="en"
        prefix={prefix}
        suffix={suffix}
        value={value}
        {...NUMBER_TIMING[kind]}
      />
    </span>
  );
}

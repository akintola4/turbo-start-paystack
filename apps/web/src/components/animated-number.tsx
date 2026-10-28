"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@workspace/tailwind-config/utils";

/**
 * Timings from the motion tokens (docs/design-system.md §5): digits move with
 * --dur-number (240ms) on the strong ease-out; fading digits use 140ms.
 * NumberFlow only animates value changes, never the first render, and turns
 * itself off under prefers-reduced-motion.
 */
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const NUMBER_TIMING = {
  transformTiming: { duration: 240, easing: EASE_OUT },
  spinTiming: { duration: 240, easing: EASE_OUT },
  opacityTiming: { duration: 140, easing: "ease-out" },
} as const;

export function AnimatedNumber({
  value,
  format,
  prefix,
  suffix,
  className,
}: {
  value: number;
  format?: Format;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <NumberFlow
      className={cn("tabular-nums", className)}
      format={format}
      locales="en"
      prefix={prefix}
      suffix={suffix}
      value={value}
      {...NUMBER_TIMING}
    />
  );
}

import { cn } from "@workspace/tailwind-config/utils";
import type * as React from "react";

import { hueOf, initials } from "@/lib/format";

/**
 * Deterministic tinted monogram. `tone` picks how loud the tint is; each
 * direction chooses. Colors use oklch so they sit well in light and dark.
 */
export function Monogram({
  name,
  seed,
  className,
  tone = "soft",
  shape = "rounded",
}: {
  name: string;
  seed?: string;
  className?: string;
  tone?: "soft" | "solid" | "mono";
  shape?: "rounded" | "circle" | "square";
}) {
  const hue = hueOf(seed ?? name);
  const style = { "--h": hue } as React.CSSProperties;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center font-medium text-xs",
        tone === "mono" && "bg-muted text-muted-foreground",
        tone === "soft" &&
          "bg-[oklch(0.93_0.045_var(--h))] text-[oklch(0.42_0.1_var(--h))] dark:bg-[oklch(0.34_0.06_var(--h))] dark:text-[oklch(0.9_0.05_var(--h))]",
        tone === "solid" && "bg-[oklch(0.6_0.13_var(--h))] text-white",
        shape === "circle" && "rounded-full",
        shape === "rounded" && "rounded-md",
        shape === "square" && "rounded-none",
        className
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}

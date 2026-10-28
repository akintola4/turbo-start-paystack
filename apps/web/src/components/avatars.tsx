import { cn } from "@workspace/tailwind-config/utils";
import type * as React from "react";

import { hueOf, initials } from "@/lib/format";

/**
 * Deterministic tinted monogram. `tone` picks how loud the tint is; each
 * caller chooses. Lightness and chroma come from the monogram tokens.
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
        tone === "soft" && "monogram-soft",
        tone === "solid" && "monogram-solid",
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

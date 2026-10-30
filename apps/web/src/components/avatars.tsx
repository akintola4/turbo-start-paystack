import { cn } from "@workspace/tailwind-config/utils";

import { initials } from "@/lib/format";

/**
 * Initials only, from the palette: people sit on surface-3; organizations
 * are a mini reference tile (panel-tile with off-white initials) in both
 * themes.
 */
export function Monogram({
  name,
  className,
  tone = "soft",
  shape = "rounded",
}: {
  name: string;
  className?: string;
  tone?: "soft" | "solid" | "mono";
  shape?: "rounded" | "circle" | "square";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center font-semibold text-xs",
        tone === "solid"
          ? "bg-panel-tile text-panel-foreground"
          : "bg-surface-3 text-foreground",
        shape === "circle" && "rounded-full",
        shape === "rounded" && "rounded-chip",
        shape === "square" && "rounded-none",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

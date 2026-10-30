import { cn } from "@workspace/tailwind-config/utils";
import type { CSSProperties } from "react";

import { GRID, type MarkColour, markGrid, radiusOf } from "@/lib/mark";

const FILL: Record<MarkColour, string> = {
  tile: "bg-panel-tile text-panel-foreground",
  off: "bg-panel-foreground text-panel",
  line: "bg-panel-line",
  ghost: "shadow-[inset_0_0_0_1px_var(--panel-line)]",
  sun: "bg-highlight text-highlight-foreground",
};

const SIZES = {
  /** Sidebar rows and menus. */
  sm: { box: "size-8 rounded-[9px] p-[3px] gap-px", glyphs: false },
  md: { box: "size-12 rounded-chip p-1 gap-px", glyphs: false },
  /** Settings headers: big enough to read the currency glyphs. */
  lg: { box: "size-20 rounded-card p-2 gap-0.5", glyphs: true },
} as const;

/**
 * "Your mark" as an avatar: the same mirrored 5×5 mark the sign-in panel
 * draws from an email (lib/mark.ts), on the forest panel colour in both
 * themes. People get theirs from their email; an organization gets one
 * from its id, so a rename or a new address doesn't change its logo.
 * Decorative: the name next to it is the label.
 */
export function MarkAvatar({
  seed,
  size = "sm",
  className,
}: {
  seed: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, glyphs } = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 select-none bg-panel", box, className)}
      data-mark-avatar
      style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
    >
      {markGrid(seed).map((slot, i) => {
        if (!slot) {
          return <span key={i} />;
        }
        const style: CSSProperties = {
          borderRadius: radiusOf(slot, "22%"),
        };
        return (
          <span
            className={cn(
              "grid aspect-square place-items-center overflow-hidden font-money font-semibold text-[9px] leading-none",
              FILL[slot.colour]
            )}
            key={i}
            style={style}
          >
            {glyphs && slot.kind === "glyph" && slot.glyph !== "KSh"
              ? slot.glyph
              : null}
          </span>
        );
      })}
    </span>
  );
}

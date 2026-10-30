"use client";

import { cn } from "@workspace/tailwind-config/utils";
import type { LucideIcon } from "lucide-react";
import { useRef } from "react";

import { nextRadioIndex } from "@/components/landing/radio";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Micro-motion the icon plays when this option becomes selected. */
  iconMotion?: "spin" | "tilt" | "pop";
  /** A quiet aside after the label, e.g. "2 months free". */
  note?: string;
};

const TONES = {
  /** On a forest panel (footer, pricing). */
  panel: {
    track: "bg-panel-tile",
    thumb: "bg-panel-foreground",
    on: "text-panel",
    off: "text-panel-muted hover:text-panel-foreground",
  },
  /** On the receipt paper. */
  paper: {
    track: "bg-transparent",
    thumb: "bg-[var(--receipt-well)]",
    on: "text-[var(--receipt-ink)]",
    off: "text-[var(--receipt-muted)] hover:text-[var(--receipt-ink)]",
  },
  /** On the page or a card. */
  page: {
    track: "bg-secondary",
    thumb: "bg-card shadow-tile",
    on: "text-foreground",
    off: "text-muted-foreground hover:text-foreground",
  },
} as const;

const ICON_MOTION = {
  spin: "animate-icon-spin",
  tilt: "animate-icon-tilt",
  pop: "animate-icon-pop",
} as const;

/** A segment submits its value when the control sits in a GET form. */
const submitProps = (name: string | undefined, value: string) =>
  name
    ? ({ type: "submit", name, value } as const)
    : ({ type: "button" } as const);

/**
 * The one segmented control on the landing: equal segments, one thumb that
 * slides on a transform with a slight spring, arrow keys and press feedback.
 * `value` may be null before mount (the theme isn't known on the server):
 * then the thumb is hidden rather than shown in the wrong place.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "page",
  size = "sm",
  name,
  className,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (value: T, from: HTMLElement) => void;
  tone?: keyof typeof TONES;
  size?: "sm" | "md";
  /** Inside a GET form: segments submit `name=value`, so the choice still
   *  works without JavaScript. With it, the click is handled in place. */
  name?: string;
  className?: string;
}) {
  const t = TONES[tone];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Icons only animate after a real change, never on first paint.
  const changes = useRef(0);
  const last = useRef(value);
  if (last.current !== value) {
    if (last.current !== null) {
      changes.current += 1;
    }
    last.current = value;
  }
  const index = options.findIndex((o) => o.value === value);
  /** The icon's arrival motion, only after a real change. */
  const arrival = (o: SegmentOption<T>) =>
    changes.current > 0 && o.iconMotion ? ICON_MOTION[o.iconMotion] : null;
  const pick = (i: number) => {
    const o = options[i];
    const el = refs.current[i];
    if (o && el && o.value !== value) {
      onChange(o.value, el);
    }
  };
  return (
    <div
      aria-label={label}
      className={cn(
        "relative grid rounded-control p-1",
        t.track,
        size === "md" ? "h-12" : "h-11",
        className
      )}
      onKeyDown={(e) => {
        const next = nextRadioIndex(e, Math.max(0, index), options.length);
        if (next !== null) {
          pick(next);
          refs.current[next]?.focus();
        }
      }}
      role="radiogroup"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 rounded-chip transition-[translate,opacity] duration-(--dur-thumb) ease-(--motion-ease-spring) motion-reduce:transition-none",
          t.thumb,
          index < 0 && "opacity-0"
        )}
        data-thumb
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          translate: `${Math.max(0, index) * 100}% 0`,
        }}
      />
      {options.map((o, i) => {
        const on = i === index;
        const Icon = o.icon;
        return (
          // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus and a sliding thumb.
          <button
            aria-checked={on}
            className={cn(
              "pressable relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 font-semibold text-[13px]",
              on ? t.on : t.off
            )}
            data-segment={o.value}
            key={o.value}
            {...submitProps(name, o.value)}
            onClick={(e) => {
              e.preventDefault();
              pick(i);
            }}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            tabIndex={(index < 0 ? i === 0 : on) ? 0 : -1}
          >
            {Icon ? (
              <Icon
                aria-hidden
                className={cn("size-3.5 shrink-0", on && arrival(o))}
                key={on ? `on-${changes.current}` : "off"}
              />
            ) : null}
            {o.label}
            {o.note ? (
              <span className="font-medium text-[11px] opacity-80">
                {o.note}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

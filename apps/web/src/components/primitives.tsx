import { cn } from "@workspace/tailwind-config/utils";
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

import { splitMoney, type Tone } from "@/lib/format";

/** Three stacked bars: a ledger, a stack, a "P" without saying it. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-7", className)}
      fill="none"
      viewBox="0 0 28 28"
    >
      <rect className="fill-primary" height="28" rx="8" width="28" />
      <rect
        fill="white"
        height="3.5"
        opacity="0.95"
        rx="1.75"
        width="14"
        x="7"
        y="7.5"
      />
      <rect
        fill="white"
        height="3.5"
        opacity="0.8"
        rx="1.75"
        width="10"
        x="7"
        y="12.25"
      />
      <rect
        fill="white"
        height="3.5"
        opacity="0.65"
        rx="1.75"
        width="6"
        x="7"
        y="17"
      />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg font-display font-semibold text-[17px] tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      href={href}
    >
      <Mark />
      <span>Turbo Start Paystack</span>
    </Link>
  );
}

const TONE: Record<Tone, string> = {
  positive:
    "bg-[oklch(0.94_0.05_162)] text-[oklch(0.38_0.1_162)] dark:bg-[oklch(0.32_0.06_162)] dark:text-[oklch(0.9_0.08_162)]",
  info: "bg-[oklch(0.94_0.04_235)] text-[oklch(0.42_0.11_240)] dark:bg-[oklch(0.32_0.06_240)] dark:text-[oklch(0.88_0.07_235)]",
  warning:
    "bg-[oklch(0.95_0.07_85)] text-[oklch(0.42_0.1_65)] dark:bg-[oklch(0.34_0.07_75)] dark:text-[oklch(0.9_0.1_85)]",
  negative:
    "bg-[oklch(0.95_0.03_25)] text-[oklch(0.48_0.17_27)] dark:bg-[oklch(0.33_0.07_25)] dark:text-[oklch(0.88_0.07_25)]",
  neutral: "bg-muted text-muted-foreground",
};

export function Chip({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-medium text-xs",
        TONE[tone],
        className
      )}
    >
      {dot ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

export function HighlightChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-[var(--c-highlight)] px-2.5 font-semibold text-[var(--c-highlight-foreground)] text-xs",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Outer tile. Radius steps down for anything nested inside it. */
export function Tile({
  children,
  className,
  as: As = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
} & HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={cn(
        "rounded-[20px] border bg-card p-6 text-card-foreground shadow-[var(--c-shadow)]",
        className
      )}
      {...props}
    >
      {children}
    </As>
  );
}

const SYMBOL: Record<string, string> = {
  NGN: "₦",
  GHS: "GH₵",
  ZAR: "R",
  KES: "KSh",
  USD: "$",
};

/** "NGN 30,000.00" becomes "₦30,000.00": local symbols read faster than ISO codes. */
export function glyphMoney(label: string) {
  return label.replace(/^([A-Z]{3})\s?/, (match, code: string) => {
    const symbol = SYMBOL[code];
    if (!symbol) {
      return match;
    }
    return symbol.length > 1 ? `${symbol} ` : symbol;
  });
}

/** Large money figure: symbol and decimals step down, digits stay tabular. */
export function Money({
  label,
  className,
  size = "lg",
  per,
}: {
  label: string;
  className?: string;
  size?: "md" | "lg" | "xl";
  per?: string;
}) {
  const { symbol, whole, decimals } = splitMoney(glyphMoney(label));
  const sizes = {
    md: "text-2xl",
    lg: "text-[32px]",
    xl: "text-[44px] sm:text-5xl",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display tabular-nums leading-none tracking-tight",
        className
      )}
    >
      <span className={cn("font-semibold", sizes[size])}>
        <span className="mr-0.5 font-medium opacity-80">{symbol}</span>
        {whole}
      </span>
      {decimals && decimals !== ".00" ? (
        <span className="font-medium text-[0.5em] opacity-70">{decimals}</span>
      ) : null}
      {per ? (
        <span className="ml-1.5 font-sans font-normal text-sm opacity-70">
          / {per}
        </span>
      ) : null}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1.5">
        <h1 className="text-balance font-display font-semibold text-[32px] leading-[1.1] tracking-tight sm:text-[40px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-[60ch] text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export const GLYPHS = [
  { glyph: "₦", code: "NGN", name: "Naira" },
  { glyph: "₵", code: "GHS", name: "Cedi" },
  { glyph: "R", code: "ZAR", name: "Rand" },
  { glyph: "KSh", code: "KES", name: "Shilling" },
  { glyph: "$", code: "USD", name: "Dollar" },
] as const;

export function GlyphMosaic() {
  // Fixed layout: 3 x 3 grid, glyphs placed deterministically.
  const cells = [0, 1, 2, 3, 4, 0, 2, 4, 1];
  return (
    <div aria-hidden className="grid grid-cols-3 gap-3">
      {cells.map((g, i) => {
        const item = GLYPHS[g];
        const strong = i === 0 || i === 4 || i === 8;
        return (
          <div
            className={
              strong
                ? "flex aspect-square items-center justify-center rounded-[20px] bg-[var(--c-highlight)] font-display font-semibold text-[var(--c-highlight-foreground)] text-[clamp(28px,3.4vw,44px)]"
                : "flex aspect-square items-center justify-center rounded-[20px] bg-white/10 font-display font-semibold text-[clamp(28px,3.4vw,44px)] text-white/90"
            }
            key={`${g}-${i}`}
          >
            {item?.glyph}
          </div>
        );
      })}
    </div>
  );
}

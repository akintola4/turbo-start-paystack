import { cn } from "@workspace/tailwind-config/utils";
import type { ReactNode } from "react";

import type { Tone } from "@/lib/format";

/** Three stacked bars: a ledger of verified events. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-5", className)}
      fill="none"
      viewBox="0 0 20 20"
    >
      <rect fill="currentColor" height="3" rx="1" width="14" x="3" y="3.5" />
      <rect
        fill="currentColor"
        height="3"
        opacity="0.6"
        rx="1"
        width="10"
        x="3"
        y="8.5"
      />
      <rect
        fill="currentColor"
        height="3"
        opacity="0.32"
        rx="1"
        width="6"
        x="3"
        y="13.5"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-semibold text-[15px] tracking-tight",
        className
      )}
    >
      <Mark />
      <span>Turbo Start Paystack</span>
    </span>
  );
}

export const TONE_TEXT: Record<Tone, string> = {
  positive: "text-success",
  info: "text-[var(--info)]",
  warning: "text-warning",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
};

export const TONE_BG: Record<Tone, string> = {
  positive: "bg-success",
  info: "bg-[var(--info)]",
  warning: "bg-warning",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground/60",
};

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        TONE_BG[tone],
        className
      )}
    />
  );
}

export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 font-medium text-[11.5px] text-foreground leading-none",
        className
      )}
    >
      <Dot tone={tone} />
      {children}
    </span>
  );
}

export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted/60 px-1 font-mono text-[10.5px] text-muted-foreground leading-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/** Page title row used by every in-app page: 32px tall, aligned to the header grid. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="grid min-w-0 gap-1">
        <h1 className="font-display font-semibold text-[22px] leading-7 tracking-[-0.02em]">
          {title}
        </h1>
        {description ? (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Vercel-style settings row: label column on the left, controls on the right. */
export function SettingsSection({
  title,
  description,
  children,
  id,
  tone,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
  tone?: "danger";
}) {
  return (
    <section
      aria-labelledby={id ? `${id}-title` : undefined}
      className="grid gap-4 border-b py-8 last:border-b-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10"
      id={id}
    >
      <div className="grid content-start gap-1">
        <h2
          className={cn(
            "font-medium text-[14px] leading-5",
            tone === "danger" && "text-destructive"
          )}
          id={id ? `${id}-title` : undefined}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-[13px] text-muted-foreground leading-5">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Bordered panel with optional footer bar. */
export function Panel({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      {children}
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

const SYMBOL: Record<string, string> = {
  NGN: "₦",
  GHS: "GH₵",
  ZAR: "R",
  KES: "KSh",
  USD: "$",
};

/** Node's ICU prints "NGN 30,000.00"; show the local symbol instead. */
export function money(label: string) {
  return label.replace(/^(NGN|GHS|ZAR|KES|USD)\s?/, (_, code: string) => {
    const symbol = SYMBOL[code] ?? code;
    return symbol.length > 1 && symbol !== "$" ? `${symbol} ` : symbol;
  });
}

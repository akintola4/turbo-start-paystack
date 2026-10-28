import { cn } from "@workspace/tailwind-config/utils";
import type { ReactNode } from "react";

import { splitMoney, type Tone } from "@/lib/format";

/** Three stacked rules of decreasing length: a ledger, a stack, a P. */
export function LedgerMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-6", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect fill="currentColor" height="24" rx="6" width="24" />
      <rect
        className="fill-background"
        height="2.5"
        rx="1.25"
        width="12"
        x="6"
        y="7"
      />
      <rect
        className="fill-background"
        height="2.5"
        rx="1.25"
        width="9"
        x="6"
        y="11"
      />
      <rect
        className="fill-background"
        height="2.5"
        rx="1.25"
        width="5"
        x="6"
        y="15"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap font-semibold text-[15px] tracking-tight",
        className
      )}
    >
      <LedgerMark className="text-primary" />
      Turbo Start Paystack
    </span>
  );
}

const TONE_CLASS: Record<Tone, string> = {
  positive: "bg-(--ledger-pos-bg) text-(--ledger-pos-ink)",
  info: "bg-(--ledger-info-bg) text-(--ledger-accent)",
  warning: "bg-(--ledger-warn-bg) text-(--ledger-warn-ink)",
  negative: "bg-(--ledger-neg-bg) text-(--ledger-neg-ink)",
  neutral: "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
  positive: "bg-success",
  info: "bg-(--ledger-accent)",
  warning: "bg-warning",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground/60",
};

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
        "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-xs",
        TONE_CLASS[tone],
        className
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", DOT_CLASS[tone])}
      />
      {children}
    </span>
  );
}

/** "₦30,000.00" with the decimals and symbol a step quieter. */
export function Money({
  label,
  className,
  quiet = true,
}: {
  label: string;
  className?: string;
  quiet?: boolean;
}) {
  const { symbol, whole, decimals, suffix } = splitMoney(label);
  return (
    <span className={cn("tabular-nums", className)}>
      <span className={cn(quiet && "text-muted-foreground")}>{symbol}</span>
      {whole}
      <span className={cn(quiet && "text-muted-foreground")}>{decimals}</span>
      {suffix}
    </span>
  );
}

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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className="font-display font-semibold text-2xl tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** A titled block: heading row on a hairline, content below. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid content-start gap-4", className)}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="grid gap-0.5">
          <h2 className="font-semibold text-[15px] tracking-tight">{title}</h2>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Bordered sheet used for statement-like panels. */
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Banner({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: "info" | "warning" | "positive";
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center",
        tone === "info" &&
          "border-(--ledger-info-border) bg-(--ledger-info-bg)",
        tone === "warning" &&
          "border-(--ledger-warn-border) bg-(--ledger-warn-bg)",
        tone === "positive" && "border-success/30 bg-(--ledger-pos-bg)"
      )}
      role={tone === "warning" ? "alert" : "status"}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 shrink-0 [&_svg]:size-4",
            tone === "info" && "text-(--ledger-accent)",
            tone === "warning" && "text-(--ledger-warn-ink)",
            tone === "positive" && "text-(--ledger-pos-ink)"
          )}
        >
          {icon}
        </span>
        <div className="grid min-w-0 gap-0.5 text-sm">
          <p className="font-medium">{title}</p>
          {children ? (
            <div className="text-muted-foreground">{children}</div>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0 pl-7 sm:pl-0">{action}</div> : null}
    </div>
  );
}

/** Thin meter for seat usage. */
export function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div
      aria-hidden
      data-label={label}
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          "h-full rounded-full",
          pct >= 90 ? "bg-warning" : "bg-(--ledger-accent)"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

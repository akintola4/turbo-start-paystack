import { cn } from "@workspace/tailwind-config/utils";
import { Badge } from "@workspace/ui/components/badge";
import {
  CalendarXIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  ClockIcon,
  CreditCardIcon,
  HourglassIcon,
  LoaderIcon,
  type LucideIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import { splitMoney } from "@/lib/format";
import { spokenMoney } from "@/lib/money";
import type { InvoiceRow, SubscriptionStatus } from "@/lib/view-models";

/**
 * The product mark: one reference tile (forest, radius 8) with a sunflower
 * tile tucked into it. Same colours in light and dark.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-7 shrink-0", className)}
      fill="none"
      viewBox="0 0 28 28"
    >
      <rect fill="var(--panel)" height="28" rx="8" width="28" />
      <rect fill="var(--panel-tile)" height="9" rx="3" width="9" x="15" y="4" />
      <rect fill="var(--panel-tile)" height="9" rx="3" width="9" x="4" y="15" />
      <rect fill="var(--highlight)" height="9" rx="3" width="9" x="4" y="4" />
      <rect
        fill="var(--panel-tile)"
        height="9"
        rx="3"
        width="9"
        x="15"
        y="15"
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
        "inline-flex items-center gap-2.5 rounded-chip font-display font-semibold text-[17px] tracking-tight",
        className
      )}
      href={href}
    >
      <Mark />
      <span>Turbo Start Paystack</span>
    </Link>
  );
}

/* ----------------------------------------------------------------- status */

type StatusVariant =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "quiet"
  | "highlight";

const SUBSCRIPTION_STATUS: Record<
  SubscriptionStatus,
  { label: string; icon: LucideIcon; variant: StatusVariant }
> = {
  active: { label: "Active", icon: CircleCheckIcon, variant: "success" },
  trialing: { label: "Trial", icon: HourglassIcon, variant: "info" },
  past_due: { label: "Past due", icon: TriangleAlertIcon, variant: "warning" },
  non_renewing: { label: "Ending", icon: CalendarXIcon, variant: "quiet" },
  canceled: { label: "Cancelled", icon: CircleSlashIcon, variant: "quiet" },
  expired: { label: "Expired", icon: CircleXIcon, variant: "destructive" },
  incomplete: { label: "Incomplete", icon: LoaderIcon, variant: "info" },
};

const INVOICE_STATUS: Record<
  InvoiceRow["status"],
  { label: string; icon: LucideIcon; variant: StatusVariant }
> = {
  paid: { label: "Paid", icon: CheckIcon, variant: "success" },
  failed: { label: "Failed", icon: XIcon, variant: "destructive" },
  void: { label: "Refunded", icon: Undo2Icon, variant: "quiet" },
  pending: { label: "Pending", icon: ClockIcon, variant: "info" },
};

/** Icon + word chip. `label` overrides the word (e.g. "Trial, 9 days left"). */
export function StatusBadge({
  status,
  label,
  graceEnded = false,
  className,
}: {
  status: SubscriptionStatus | "free";
  label?: string;
  /** Past due becomes danger once the grace period has run out. */
  graceEnded?: boolean;
  className?: string;
}) {
  if (status === "free") {
    return (
      <Badge className={className} variant="quiet">
        Free
      </Badge>
    );
  }
  const meta = SUBSCRIPTION_STATUS[status];
  const Icon = meta.icon;
  const variant =
    status === "past_due" && graceEnded ? "destructive" : meta.variant;
  return (
    <Badge className={className} variant={variant}>
      <Icon aria-hidden />
      {label ?? meta.label}
    </Badge>
  );
}

export function InvoiceBadge({
  status,
  className,
}: {
  status: InvoiceRow["status"];
  className?: string;
}) {
  const meta = INVOICE_STATUS[status];
  const Icon = meta.icon;
  return (
    <Badge className={className} variant={meta.variant}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );
}

/** Neutral or tonal chip without an icon, for roles and counts. */
export function Chip({
  children,
  className,
  variant = "quiet",
}: {
  children: ReactNode;
  className?: string;
  variant?: StatusVariant;
}) {
  return (
    <Badge className={className} variant={variant}>
      {children}
    </Badge>
  );
}

/* --------------------------------------------------------------- surfaces */

/** Card: surface-1 with a 1px ring; radius steps down for anything inside. */
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
        "rounded-tile bg-card p-5 text-card-foreground shadow-tile sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </As>
  );
}

/**
 * The money panel: a dark forest island in both themes. `class="dark"`
 * re-scopes every token inside it, so buttons, badges and focus rings adapt.
 */
export function Panel({
  children,
  className,
  as: As = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "aside" | "article";
} & HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={cn("dark rounded-panel p-5 sm:p-7", className)}
      data-surface="panel"
      {...props}
    >
      {children}
    </As>
  );
}

/* ------------------------------------------------------------------ money */

/**
 * Display amount. Symbol, digits and the period unit are one NumberFlow:
 * the symbol at the digits' size and weight (from the shared formatter),
 * `.00` hidden, and the unit as a smaller muted suffix on the same baseline.
 * The number animates its own width; nothing else is reserved.
 */
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
  const { symbol, whole, decimals } = splitMoney(label);
  const sizes = {
    md: "text-2xl",
    lg: "text-[32px]",
    xl: "text-[40px] sm:text-[56px]",
  } as const;
  const showDecimals = Boolean(decimals && decimals !== ".00");
  const spoken = spokenMoney(label, per);
  return (
    <AnimatedNumber
      className={cn(
        "money font-money font-semibold leading-none tracking-[-0.02em]",
        sizes[size],
        className
      )}
      format={{
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
      }}
      kind="money"
      label={spoken}
      prefix={symbol}
      suffix={per ? `\u2009/\u2009${per}` : undefined}
      value={Number(
        `${whole.replaceAll(",", "")}${showDecimals ? decimals : ""}`
      )}
    />
  );
}

/**
 * Inline / table amount: same size as the text around it, right-aligned by
 * the caller. Screen readers get the spoken form ("30,000 naira").
 */
export function Amount({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn("font-money font-medium tabular-nums", className)}
      data-money
    >
      <span aria-hidden>{label}</span>
      <span className="sr-only">{spokenMoney(label)}</span>
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
      <div className="grid gap-2">
        <h1 className="font-display font-semibold text-[32px] leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
          {title}
        </h1>
        {description ? (
          <div className="text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------- currency */

export const GLYPHS = [
  { glyph: "₦", code: "NGN", name: "Naira" },
  { glyph: "₵", code: "GHS", name: "Cedi" },
  { glyph: "R", code: "ZAR", name: "Rand" },
  { glyph: "KSh", code: "KES", name: "Shilling" },
  { glyph: "$", code: "USD", name: "Dollar" },
] as const;

/** Reference grid order: each currency appears at least once. */
export const MOSAIC = [0, 1, 2, 3, 4, 0, 2, 1, 4];

/**
 * The reference grid. The tiles for `active` take sunflower; the rest stay
 * tile green. Colour-only transition, so nothing moves.
 */
export function GlyphMosaic({
  active = "NGN",
  className,
}: {
  active?: string;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("grid grid-cols-3 gap-4", className)}>
      {MOSAIC.map((g, i) => {
        const item = GLYPHS[g];
        const on = item?.code === active;
        return (
          <div
            className={cn(
              "flex aspect-square select-none items-center justify-center rounded-tile font-bold font-money transition-[background-color,color] duration-(--dur-fast) ease-out",
              on
                ? "bg-highlight text-highlight-foreground"
                : "bg-panel-tile text-panel-foreground",
              item?.glyph === "KSh"
                ? "text-[clamp(25px,4.7vw,41px)]"
                : "text-[clamp(32px,6vw,52px)]"
            )}
            key={`${item?.code}-${i}`}
          >
            {item?.glyph}
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Visa ending 4081" with the masked digits drawn as dots, not typed as
 * bullet characters, so they sit on the text's x-height in every font.
 */
export function CardNumber({
  brand,
  last4,
  className,
}: {
  brand: string | null;
  last4: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 tabular-nums", className)}
    >
      <CreditCardIcon aria-hidden className="size-4 shrink-0 opacity-70" />
      <span className="capitalize">{brand ?? "Card"}</span>
      <span aria-hidden className="inline-flex items-center gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span className="size-1 rounded-full bg-current opacity-70" key={i} />
        ))}
      </span>
      <span className="sr-only">ending in</span>
      {last4}
    </span>
  );
}

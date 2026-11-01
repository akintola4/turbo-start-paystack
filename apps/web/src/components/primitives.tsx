import { cn } from "@workspace/tailwind-config/utils";
import { Badge } from "@workspace/ui/components/badge";
import {
  CalendarXIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  CircleXIcon,
  ClockIcon,
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
import { opticalEdge } from "@/components/landing/display";
import {
  CELL,
  CELL_RADIUS,
  MARK_CELLS,
  MARK_LIT,
  MARK_RADIUS,
  MARK_VIEWBOX,
} from "@/lib/brand";
import { formatDate, splitMoney } from "@/lib/format";
import { spokenMoney } from "@/lib/money";
import {
  INVOICE_BADGE_LABEL,
  type InvoiceBadgeStatus,
  REFUND_BADGES,
} from "@/lib/invoice-status";
import type { SubscriptionStatus } from "@/lib/view-models";

/**
 * The product mark: a woven 3×3 grid on a forest tile, the middle column
 * slipped half a step with the sunflower cell in the slip (lib/brand). Same
 * colours in light and dark; on a forest panel the tile lifts a step so it
 * doesn't vanish into the ground.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-7 shrink-0", className)}
      fill="none"
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
    >
      <rect
        fill="var(--mark-tile, var(--panel))"
        height={MARK_VIEWBOX}
        rx={MARK_RADIUS}
        width={MARK_VIEWBOX}
      />
      {MARK_CELLS.map(([x, y]) => (
        <rect
          fill="var(--mark-cell, var(--panel-line))"
          height={CELL}
          key={`${x}-${y}`}
          rx={CELL_RADIUS}
          width={CELL}
          x={x}
          y={y}
        />
      ))}
      <rect
        fill="var(--highlight)"
        height={CELL}
        rx={CELL_RADIUS}
        width={CELL}
        x={MARK_LIT[0]}
        y={MARK_LIT[1]}
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
        "inline-flex min-h-11 items-center gap-2.5 rounded-chip font-display font-semibold text-[17px] tracking-tight",
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
  InvoiceBadgeStatus,
  { icon: LucideIcon; variant: StatusVariant }
> = {
  paid: { icon: CheckIcon, variant: "success" },
  failed: { icon: XIcon, variant: "destructive" },
  pending: { icon: ClockIcon, variant: "info" },
  refund_pending: { icon: ClockIcon, variant: "info" },
  refunded: { icon: Undo2Icon, variant: "quiet" },
  refund_failed: { icon: CircleXIcon, variant: "destructive" },
  refund_delayed: { icon: TriangleAlertIcon, variant: "warning" },
};

/**
 * The one word for a plan's state, everywhere it appears (badge, sidebar,
 * org list): "Active", "Trial", "Past due", "Ends 12 Mar"… A plan that
 * ends shows its date when the viewer may see dates, "Ending" otherwise.
 */
export function statusLabel(
  status: SubscriptionStatus,
  endsAt?: string | null
) {
  if (status === "non_renewing" && endsAt) {
    return `Ends ${formatDate(endsAt, "short")}`;
  }
  return SUBSCRIPTION_STATUS[status].label;
}

/** Icon + word chip. `label` overrides the word (e.g. "Trial, 9 days left"). */
export function StatusBadge({
  status,
  label,
  endsAt,
  graceEnded = false,
  className,
}: {
  status: SubscriptionStatus | "free";
  label?: string;
  /** For non_renewing: the day access ends ("Ends 12 Mar"). */
  endsAt?: string | null;
  /** Past due becomes danger once the grace period has run out. */
  graceEnded?: boolean;
  className?: string;
}) {
  if (status === "free") {
    return (
      <Badge className={className} variant="quiet">
        <CircleDashedIcon aria-hidden />
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
      {label ?? statusLabel(status, endsAt)}
    </Badge>
  );
}

/**
 * A refund chip is as wide as the widest refund label, so it doesn't change
 * width as the refund moves from pending to refunded (or failed).
 */
export function InvoiceBadge({
  status,
  className,
}: {
  status: InvoiceBadgeStatus;
  className?: string;
}) {
  const meta = INVOICE_STATUS[status];
  const Icon = meta.icon;
  const isRefund = (REFUND_BADGES as readonly string[]).includes(status);
  return (
    <Badge
      className={cn(isRefund && "justify-start", className)}
      variant={meta.variant}
    >
      <Icon aria-hidden />
      {isRefund ? (
        <span className="grid">
          {REFUND_BADGES.map((s) => (
            <span
              className={cn("[grid-area:1/1]", s !== status && "invisible")}
              key={s}
            >
              {INVOICE_BADGE_LABEL[s]}
            </span>
          ))}
        </span>
      ) : (
        INVOICE_BADGE_LABEL[status]
      )}
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
        "money font-money font-semibold tracking-[-0.02em]",
        sizes[size],
        // After the size: tailwind-merge drops a line-height that comes
        // before a text-* size, and the box then grew to 1.5× the text.
        "leading-none",
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

/**
 * Title and actions share the first row; the actions box is one title line
 * tall (44px at 40/1.1), so they centre on the title's line, not on the
 * title plus description. A long title wraps under its own column and the
 * actions stay on its first line. Below sm the actions follow the
 * description. String titles take an optical left edge, so the first
 * letter's ink, not its side bearing, sits on the content edge.
 */
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
    <header
      className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]"
      data-page-header
    >
      <h1
        className="text-balance font-display font-semibold text-[32px] leading-[1.1] tracking-[-0.02em] sm:text-[40px]"
        style={typeof title === "string" ? opticalEdge(title) : undefined}
      >
        {title}
      </h1>
      {description ? (
        <div className="text-muted-foreground sm:col-start-1">
          {description}
        </div>
      ) : null}
      {actions ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 sm:col-start-2 sm:row-start-1 sm:mt-0 sm:h-11"
          data-page-actions
        >
          {actions}
        </div>
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
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 tabular-nums",
        className
      )}
    >
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

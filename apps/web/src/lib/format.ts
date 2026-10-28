import type { SubscriptionStatus } from "@/directions/types";

/** Dates render in UTC so server and client output match (no hydration drift). */
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDate(
  value: string | null | undefined,
  style: "long" | "short" = "long"
) {
  if (!value) {
    return "—";
  }
  return (style === "short" ? shortFmt : dateFmt).format(new Date(value));
}

/** Whole days from now until `value` (negative when past). */
export function daysUntil(value: string | null | undefined, now = Date.now()) {
  if (!value) {
    return null;
  }
  return Math.ceil((new Date(value).getTime() - now) / 86_400_000);
}

export type Tone = "positive" | "info" | "warning" | "negative" | "neutral";

export const STATUS_META: Record<
  SubscriptionStatus | "free",
  { label: string; tone: Tone }
> = {
  active: { label: "Active", tone: "positive" },
  trialing: { label: "Trial", tone: "info" },
  past_due: { label: "Past due", tone: "warning" },
  non_renewing: { label: "Cancels at period end", tone: "neutral" },
  canceled: { label: "Canceled", tone: "negative" },
  expired: { label: "Expired", tone: "negative" },
  incomplete: { label: "Incomplete", tone: "neutral" },
  free: { label: "Free", tone: "neutral" },
};

export const INVOICE_META: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "positive" },
  pending: { label: "Pending", tone: "info" },
  failed: { label: "Failed", tone: "negative" },
  void: { label: "Refunded", tone: "neutral" },
};

export const ROLE_META: Record<string, { label: string; description: string }> =
  {
    owner: {
      label: "Owner",
      description: "Full access, including deleting the organization",
    },
    admin: {
      label: "Admin",
      description: "Manages members and settings; can view billing",
    },
    billing: {
      label: "Billing",
      description: "Manages the plan, card and invoices",
    },
    member: { label: "Member", description: "Uses the product" },
    viewer: { label: "Viewer", description: "Read-only access" },
  };

export const roleLabel = (role: string) => ROLE_META[role]?.label ?? role;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Stable 0-359 hue from a string (integer hash, no floating trig). */
export function hueOf(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function intervalLabel(
  interval: string,
  style: "short" | "long" = "short"
) {
  if (interval === "annually") {
    return style === "short" ? "yr" : "year";
  }
  return style === "short" ? "mo" : "month";
}

/** Splits "₦30,000.00" into symbol / whole / decimals for typographic money. */
export function splitMoney(label: string) {
  const match = label.match(/^([^\d]*)([\d,]+)(\.\d+)?(.*)$/);
  if (!match) {
    return { symbol: "", whole: label, decimals: "", suffix: "" };
  }
  return {
    symbol: match[1] ?? "",
    whole: match[2] ?? "",
    decimals: match[3] ?? "",
    suffix: match[4] ?? "",
  };
}

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
  // en-GB writes September as "Sept"; keep every month to three letters.
  return (style === "short" ? shortFmt : dateFmt)
    .format(new Date(value))
    .replace("Sept", "Sep");
}

/** Whole days from now until `value` (negative when past). */
export function daysUntil(value: string | null | undefined, now = Date.now()) {
  if (!value) {
    return null;
  }
  return Math.ceil((new Date(value).getTime() - now) / 86_400_000);
}

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

/** Legal suffixes that never make an initial: "Turbo Start Ltd" → "TS". */
const LEGAL_SUFFIX = /^(ltd|limited|llc|inc|plc|gmbh|pty|co)\.?$/i;

/** First and last initial: "Ada Okafor" → "AO", "Kola Logistics Ltd" → "KL". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && LEGAL_SUFFIX.test(parts.at(-1) ?? "")) {
    parts.pop();
  }
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
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

/** "monthly" / "yearly", for "Pro, monthly billing" and scheduled changes. */
export function intervalAdverb(interval: string) {
  return interval === "annually" ? "yearly" : "monthly";
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

/** "tunde@kola.test" → "t***@kola.test": enough to recognise, not to harvest. */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

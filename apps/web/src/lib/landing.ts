import type { Currency } from "@workspace/billing/money";

/** Pure helpers for the landing page, kept here so they can be unit tested. */

export const REPO = "https://github.com/akintola4/turbo-start-paystack";

/** A file in the repo on GitHub. */
export const fileUrl = (path: string) => `${REPO}/blob/main/${path}`;

/** The install steps, one shell command each, as the README lists them. */
export const INSTALL_STEPS = [
  "npx degit akintola4/turbo-start-paystack my-saas",
  "cd my-saas",
  "pnpm install",
  "pnpm setup",
] as const;

/** The same steps as one line, which is what Copy puts on the clipboard. */
export const INSTALL_COMMAND = INSTALL_STEPS.join(" && ");

/** The live site, which serves the agent guide at /llms.txt. */
export const SITE = "https://turbo-start-paystack.vercel.app";

/** The placeholder a visitor replaces with their idea. Left as is, the agent
 *  stops once the starter runs and asks what to build. */
export const AGENT_IDEA_PLACEHOLDER = "[describe your product here]";

/**
 * What "Your agent" copies: a prompt for any coding agent (Claude Code,
 * Cursor, Codex…) that sets the starter up from the docs written for agents,
 * then builds the visitor's idea within the starter's billing rules.
 */
export const AGENT_PROMPT_LINES = [
  "Set up Turbo Start Paystack and build on it.",
  `1. Read ${SITE}/llms.txt, then AGENTS.md in the repo. Follow them.`,
  `2. Run: ${INSTALL_COMMAND}`,
  "   Needs Node 24+. It runs on the bundled Paystack mock, no keys needed.",
  "   pnpm uses the version the repo pins; ignore its prompts to upgrade.",
  "3. Start pnpm dev in the background and check the demo org signs in.",
  `4. Then build this: ${AGENT_IDEA_PLACEHOLDER}`,
  "   If that line is still in brackets, stop after step 3 and ask me what to build.",
  "Keep AGENTS.md's hard rules: billing data never comes from the browser, permissions are checked on the server, money stays in integer subunits.",
] as const;

export const AGENT_PROMPT = AGENT_PROMPT_LINES.join("\n");

export type CurrencyMeta = {
  code: Currency;
  /** Tile glyph. GH₵ shortens to ₵ on tiles only; amounts use GH₵. */
  glyph: string;
  /** Plural, lower case, for running copy: "priced in cedis". */
  word: string;
};

export const CURRENCY_META: readonly CurrencyMeta[] = [
  { code: "NGN", glyph: "₦", word: "naira" },
  { code: "GHS", glyph: "₵", word: "cedis" },
  { code: "ZAR", glyph: "R", word: "rand" },
  { code: "KES", glyph: "KSh", word: "shillings" },
  { code: "USD", glyph: "$", word: "dollars" },
];

export function currencyMeta(code: Currency): CurrencyMeta {
  return (
    CURRENCY_META.find((c) => c.code === code) ??
    (CURRENCY_META[0] as CurrencyMeta)
  );
}

/**
 * The hero wall: 16 tiles on desktop (8 x 2), the first 12 on phones (4 x 3).
 * Every currency appears at least twice in both layouts and no two neighbours
 * repeat, so a ripple always has somewhere to travel.
 */
export const WALL: readonly Currency[] = [
  "NGN",
  "GHS",
  "ZAR",
  "KES",
  "USD",
  "NGN",
  "ZAR",
  "GHS",
  "USD",
  "KES",
  "NGN",
  "USD",
  "GHS",
  "ZAR",
  "NGN",
  "KES",
];

/** Delay before tile `index` changes colour, rippling out from `origin`. */
export function rippleDelay(
  index: number,
  origin: number,
  columns: number,
  stepMs = 28
): number {
  const dx = (index % columns) - (origin % columns);
  const dy = Math.floor(index / columns) - Math.floor(origin / columns);
  return Math.round(Math.hypot(dx, dy) * stepMs);
}

/**
 * Bar widths for the receipt's barcode, derived from a string (the version)
 * so it is stable between renders and changes when the version does.
 * Returns alternating [bar, gap] widths in px, 1 to 4 each.
 */
export function barcode(seed: string, length = 40): number[] {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const ch = seed.charCodeAt(i % Math.max(1, seed.length)) || 0;
    h = Math.imul(h ^ (ch + i), 16777619) >>> 0;
    out.push(1 + (h % 4));
  }
  return out;
}

export type ProviderStatus =
  | "normal"
  | "incident"
  | "degraded"
  | "outage"
  | "maintenance";

/**
 * Paystack's status page (status.paystack.com/api/v2/summary.json) reports
 * `page.status` as UP, HASISSUES, UNDERMAINTENANCE, or an impact word that
 * starts with ONE (one component affected: ONEMAJOROUTAGE, ONEMINOROUTAGE)
 * or ALL (the whole platform). Only a platform-wide major outage is an
 * "outage"; one bank or one component having trouble is an "incident".
 * Anything unrecognised returns null and the footer shows a neutral link.
 */
export function parseProviderStatus(raw: unknown): ProviderStatus | null {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.toUpperCase();
  if (s === "UP" || s === "OPERATIONAL" || s === "ALLUP") {
    return "normal";
  }
  if (s.includes("MAINTENANCE")) {
    return "maintenance";
  }
  if (s.startsWith("ONE")) {
    return "incident";
  }
  if (s.includes("MAJOR")) {
    return "outage";
  }
  if (
    s.includes("MINOR") ||
    s.includes("ISSUES") ||
    s.includes("DEGRADED") ||
    s.includes("PARTIAL")
  ) {
    return "degraded";
  }
  return null;
}

/** "29 Oct 2026" from an ISO date, or null when there is no usable date. */
export function formatUpdated(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

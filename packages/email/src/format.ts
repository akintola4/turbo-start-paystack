import { formatMoney } from "@workspace/billing/money";

export { formatMoney };

export const EMAIL_CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;
export type EmailCurrency = (typeof EMAIL_CURRENCIES)[number];

/** "28 October 2026", always in UTC so the server's zone never leaks in. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "28 Oct 2026", for ranges where the long form would wrap. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatInterval(interval: string): string {
  return interval === "annually" ? "yearly" : interval;
}

export const EMAIL_CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;
export type EmailCurrency = (typeof EMAIL_CURRENCIES)[number];

const SYMBOLS: Record<EmailCurrency, string> = {
  NGN: "₦",
  GHS: "GH₵",
  ZAR: "R",
  KES: "KSh",
  USD: "$",
};

const amountFormat = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Integer subunits (kobo, pesewas, cents) to a display string, e.g.
 * `formatMoney(1500000, "NGN")` is "₦15,000.00". Every Paystack currency has
 * two decimal places. Symbols are fixed here rather than taken from Intl,
 * which renders them inconsistently across locales ("R 1.00", "KES 1.00").
 */
export function formatMoney(amountSubunit: number, currency: string): string {
  if (!Number.isInteger(amountSubunit)) {
    throw new Error("amountSubunit must be an integer number of subunits");
  }
  const amount = amountFormat.format(amountSubunit / 100);
  const symbol = SYMBOLS[currency as EmailCurrency];
  return symbol ? `${symbol}${amount}` : `${currency} ${amount}`;
}

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

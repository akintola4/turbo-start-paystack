export const CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Smallest card charge used to tokenise a card for a card-up-front trial
 * (refunded right after). Paystack's recommended minimums, in subunits.
 * KES is not documented; 10 KES is a guess to confirm in test mode.
 */
export const TOKENIZATION_AMOUNT: Record<Currency, number> = {
  NGN: 5000,
  GHS: 10,
  ZAR: 100,
  USD: 20,
  KES: 1000,
};

/**
 * Display symbols. Intl prints "NGN 30,000.00", "R 540,00" or "Ksh" depending
 * on runtime and locale, so the symbols are fixed here. The alphabetic KSh
 * takes a narrow no-break space (U+202F); ₦, GH₵, R and $ stay attached.
 */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  NGN: "₦",
  GHS: "GH₵",
  ZAR: "R",
  KES: "KSh\u202f",
  USD: "$",
};

const amountFormat = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Integer subunits (kobo, pesewas, cents) to a display string, e.g.
 * `formatMoney(1500000, "NGN")` is "₦15,000.00". Every Paystack currency has
 * two decimal places. Negative amounts use a real minus sign (U+2212). This
 * is the one formatter for the app and the emails.
 */
export function formatMoney(amountSubunit: number, currency: string): string {
  if (!Number.isInteger(amountSubunit)) {
    throw new Error("amountSubunit must be an integer number of subunits");
  }
  const amount = amountFormat.format(Math.abs(amountSubunit) / 100);
  const sign = amountSubunit < 0 ? "\u2212" : "";
  const symbol = isCurrency(currency) ? CURRENCY_SYMBOL[currency] : undefined;
  return symbol ? `${sign}${symbol}${amount}` : `${sign}${currency} ${amount}`;
}

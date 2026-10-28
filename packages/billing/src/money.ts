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

/** All Paystack currencies use 2 decimal subunits (amount × 100). */
export function formatMoney(amountSubunit: number, currency: Currency): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
  }).format(amountSubunit / 100);
}

/**
 * One formatter for every amount the UI shows. Amounts are integer subunits
 * (kobo, pesewas, cents); every Paystack currency has two decimals.
 *
 * Intl prints "NGN 30,000.00" for naira on most runtimes (Node included), so
 * the local symbol is added here instead of trusting `currencyDisplay`.
 */
export const CURRENCY_SYMBOL: Record<string, string> = {
  NGN: "₦",
  GHS: "GH₵",
  ZAR: "R",
  KES: "KSh ",
  USD: "$",
};

const number = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amountSubunit: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const sign = amountSubunit < 0 ? "-" : "";
  return `${sign}${symbol}${number.format(Math.abs(amountSubunit) / 100)}`;
}

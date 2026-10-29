import { CURRENCY_SYMBOL } from "./money";

/**
 * NumberFlow props that print exactly what `formatMoney` prints: the shared
 * display symbol (U+00A0 after KSh, see lib/money.ts) as the prefix and two decimals with
 * English grouping. `money-flow.test.ts` checks every currency.
 */
export function moneyFlowProps(amountSubunit: number, currency: string) {
  const symbol =
    CURRENCY_SYMBOL[currency as keyof typeof CURRENCY_SYMBOL] ?? `${currency} `;
  return {
    value: amountSubunit / 100,
    locales: "en",
    format: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    prefix: symbol,
  } as const;
}

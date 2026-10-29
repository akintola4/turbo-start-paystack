import { CURRENCY_SYMBOL } from "@workspace/billing/money";

/**
 * NumberFlow props that print exactly what `formatMoney` prints: the shared
 * symbol (with its U+202F after KSh) as the prefix and two decimals with
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

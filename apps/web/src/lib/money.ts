import {
  type Currency,
  CURRENCY_SYMBOL as SHARED_SYMBOL,
  formatMoney as sharedFormatMoney,
} from "@workspace/billing/money";

/**
 * The money formatter for the screen. The shared one (also used by the
 * emails) puts U+202F, a narrow no-break space, after KSh. Geist has no
 * U+202F glyph, so on screen it came from a system font and read as
 * "KSh0.00". The web shows U+00A0 instead: Geist has it, at the width of its
 * own space. Emails keep U+202F. Client-safe (no deps).
 */
const NARROW_NBSP = / /g;
const NBSP = " ";

export const CURRENCY_SYMBOL = Object.fromEntries(
  Object.entries(SHARED_SYMBOL).map(([code, symbol]) => [
    code,
    symbol.replace(NARROW_NBSP, NBSP),
  ])
) as Record<Currency, string>;

export function formatMoney(
  ...args: Parameters<typeof sharedFormatMoney>
): string {
  return sharedFormatMoney(...args).replace(NARROW_NBSP, NBSP);
}

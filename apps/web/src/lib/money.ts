import {
  type Currency,
  CURRENCY_SYMBOL as SHARED_SYMBOL,
  formatMoney as sharedFormatMoney,
} from "@workspace/billing/money";

import { splitMoney } from "@/lib/format";

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

const SPOKEN: Record<string, string> = {
  "₦": "naira",
  "GH₵": "cedis",
  R: "rand",
  KSh: "shillings",
  $: "dollars",
};

/**
 * What a screen reader should say for a formatted amount: "₦30,000.00" →
 * "30,000 naira", "−₦50.00" → "minus 50 naira". "N with two bars" isn't
 * spoken reliably, so every amount carries this as its accessible text.
 * The symbol is matched without its trailing space (KSh takes U+00A0 on
 * screen and U+202F in emails).
 */
export function spokenMoney(label: string, per?: string) {
  const negative = label.startsWith("\u2212");
  const { symbol, whole, decimals } = splitMoney(
    negative ? label.slice(1) : label
  );
  const cents = decimals && decimals !== ".00" ? decimals : "";
  const unit = SPOKEN[symbol.trim()] ?? symbol.trim();
  return `${negative ? "minus " : ""}${whole}${cents} ${unit}${per ? ` per ${per}` : ""}`;
}

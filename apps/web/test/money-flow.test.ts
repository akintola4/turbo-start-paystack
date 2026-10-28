import { CURRENCIES, formatMoney } from "@workspace/billing/money";
import { formatToData } from "number-flow/lite";
import { describe, expect, it } from "vitest";

import { moneyFlowProps } from "../src/lib/money-flow";

describe("NumberFlow money matches formatMoney", () => {
  const amounts = [
    0, 5000, 1_000_000, 3_000_000, 130_000, 390_000, 3000, 100_000_050,
  ];
  for (const currency of CURRENCIES) {
    it(currency, () => {
      for (const amount of amounts) {
        const p = moneyFlowProps(amount, currency);
        const flow = formatToData(
          p.value,
          new Intl.NumberFormat(p.locales, p.format),
          p.prefix
        ).valueAsString;
        expect(flow).toBe(formatMoney(amount, currency));
      }
    });
  }

  it("keeps the narrow no-break space after KSh", () => {
    const p = moneyFlowProps(300_000, "KES");
    expect(p.prefix).toBe("KSh ");
  });
});

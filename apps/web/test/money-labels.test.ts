import { describe, expect, it } from "vitest";

import { spokenMoney } from "../src/lib/money";

describe("spokenMoney", () => {
  it("speaks the currency name instead of its symbol", () => {
    expect(spokenMoney("₦30,000.00")).toBe("30,000 naira");
    expect(spokenMoney("GH₵450.00")).toBe("450 cedis");
    expect(spokenMoney("R540.00")).toBe("540 rand");
    expect(spokenMoney("$29.00")).toBe("29 dollars");
  });

  it("matches KSh whichever no-break space follows it", () => {
    expect(spokenMoney("KSh\u00a03,900.00")).toBe("3,900 shillings");
    expect(spokenMoney("KSh\u202f3,900.00")).toBe("3,900 shillings");
  });

  it("keeps non-zero cents, the minus sign and the period", () => {
    expect(spokenMoney("₦50.25")).toBe("50.25 naira");
    expect(spokenMoney("−₦50.00")).toBe("minus 50 naira");
    expect(spokenMoney("₦30,000.00", "month")).toBe("30,000 naira per month");
  });
});

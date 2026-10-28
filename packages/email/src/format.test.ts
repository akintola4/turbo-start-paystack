import { describe, expect, it } from "vitest";

import { formatDate, formatMoney, formatShortDate } from "./format";

describe("formatMoney", () => {
  it.each([
    [1_500_000, "NGN", "₦15,000.00"],
    [15_000, "GHS", "GH₵150.00"],
    [18_000, "ZAR", "R180.00"],
    [130_000, "KES", "KSh\u202f1,300.00"],
    [1000, "USD", "$10.00"],
    [5, "NGN", "₦0.05"],
    [0, "USD", "$0.00"],
    [123_456_789, "NGN", "₦1,234,567.89"],
  ])("%i %s is %s", (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });

  it("falls back to the code for other currencies", () => {
    expect(formatMoney(1000, "EUR")).toBe("EUR 10.00");
  });

  it("rejects non-integer subunits (someone divided by 100)", () => {
    expect(() => formatMoney(10.5, "NGN")).toThrow(/integer/);
  });
});

describe("dates", () => {
  it("formats in UTC regardless of the server zone", () => {
    const lateUtc = new Date("2026-10-28T23:30:00Z");
    expect(formatDate(lateUtc)).toBe("28 October 2026");
    expect(formatShortDate(lateUtc)).toBe("28 Oct 2026");
  });
});

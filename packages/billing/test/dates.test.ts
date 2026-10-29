import { describe, expect, it } from "vitest";

import { formatPeriod } from "../src/dates";

describe("formatPeriod", () => {
  it("writes the year once when the period stays inside it", () => {
    expect(
      formatPeriod(new Date("2026-11-12T00:00Z"), new Date("2026-12-12T00:00Z"))
    ).toBe("12 Nov – 12 Dec 2026");
  });

  it("writes both years when the period crosses one", () => {
    expect(
      formatPeriod(new Date("2026-12-12T00:00Z"), new Date("2027-01-12T00:00Z"))
    ).toBe("12 Dec 2026 – 12 Jan 2027");
  });

  it("keeps September to three letters", () => {
    expect(
      formatPeriod(new Date("2026-09-01T00:00Z"), new Date("2026-10-01T00:00Z"))
    ).toBe("1 Sep – 1 Oct 2026");
  });
});

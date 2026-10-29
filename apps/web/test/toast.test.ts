import { describe, expect, it } from "vitest";

import { toastDuration } from "../src/lib/toast";

describe("toastDuration", () => {
  it("never drops below four seconds", () => {
    expect(toastDuration("Saved")).toBe(4000);
  });

  it("gives long messages a quarter second per word", () => {
    const description = Array.from({ length: 24 }, () => "word").join(" ");
    expect(toastDuration("Two words", description)).toBe(6500);
  });
});

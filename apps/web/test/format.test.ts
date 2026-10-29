import { describe, expect, it } from "vitest";

import { initials, maskEmail } from "../src/lib/format";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("tunde@kolalogistics.test")).toBe(
      "t***@kolalogistics.test"
    );
  });
});

describe("initials", () => {
  it("takes first and last name", () => {
    expect(initials("Ada Okafor")).toBe("AO");
    expect(initials("Ada Chioma Okafor")).toBe("AO");
  });

  it("skips a legal suffix", () => {
    expect(initials("Kola Logistics Ltd")).toBe("KL");
    expect(initials("Turbo Start Limited")).toBe("TS");
    expect(initials("Ltd")).toBe("L");
  });
});

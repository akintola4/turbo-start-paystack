import { describe, expect, it } from "vitest";

import { safeCallback } from "../src/lib/safe-callback";

describe("safeCallback (audit #10)", () => {
  it("keeps same-origin paths", () => {
    for (const path of [
      "/",
      "/app",
      "/app/kola-logistics/settings/billing?tab=invoices",
      "/accept-invite/abc#top",
      "/app/caf%C3%A9",
    ]) {
      expect(safeCallback(path)).toBe(path);
    }
  });

  it("refuses anything a browser could read as another origin", () => {
    for (const value of [
      null,
      "",
      "app",
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "\\/evil.test",
      "/\t/evil.test",
      "/\n/evil.test",
      "/\r\n/evil.test",
      "/ /evil.test",
      "/\u0000/evil.test",
      "/ /evil.test",
      "/app\\..\\evil",
      "javascript:alert(1)",
    ]) {
      expect(safeCallback(value)).toBe("/app");
    }
  });
});

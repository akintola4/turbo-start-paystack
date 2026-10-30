import { describe, expect, it } from "vitest";

import { postAuthLanding, safeCallback } from "../src/lib/safe-callback";

describe("postAuthLanding", () => {
  it("lets plain /app skip the org picker", () => {
    expect(postAuthLanding("/app")).toBe("/app?from=sign-in");
  });

  it("keeps any other safe callback as is", () => {
    expect(postAuthLanding("/app/kola-logistics/members")).toBe(
      "/app/kola-logistics/members"
    );
    expect(postAuthLanding("/accept-invite/abc")).toBe("/accept-invite/abc");
  });

  it("sends an unsafe callback to the dashboard", () => {
    expect(postAuthLanding(safeCallback("//evil.example"))).toBe(
      "/app?from=sign-in"
    );
  });
});

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

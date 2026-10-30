import { describe, expect, it } from "vitest";

import { toastKindFor } from "../src/lib/dev-log";

describe("toastKindFor", () => {
  it("is a success only when every step was ok", () => {
    expect(toastKindFor(["ok", "ok"])).toBe("success");
  });

  it("warns on a rejected signature or an ignored duplicate", () => {
    expect(toastKindFor(["rejected", "ok"])).toBe("warning");
    expect(toastKindFor(["ignored"])).toBe("warning");
  });

  it("errors when any step errored", () => {
    expect(toastKindFor(["ok", "ignored", "error"])).toBe("error");
  });
});

import { describe, expect, it } from "vitest";

import { redact } from "./index";

describe("redact", () => {
  it("masks secret-looking keys at any depth", () => {
    expect(
      redact({
        email_token: "x",
        nested: { authorization_code: "y", list: [{ secretKey: "z" }] },
        ok: 1,
      })
    ).toEqual({
      email_token: "[redacted]",
      nested: {
        authorization_code: "[redacted]",
        list: [{ secretKey: "[redacted]" }],
      },
      ok: 1,
    });
  });

  it("leaves primitives alone", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(null)).toBe(null);
  });
});

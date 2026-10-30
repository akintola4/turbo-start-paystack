import { describe, expect, it } from "vitest";

import { authFormError, RATE_LIMITED } from "../src/lib/auth-errors";
import { currencyFromAcceptLanguage } from "../src/lib/locale-currency";

describe("authFormError", () => {
  it("reads a rate limit as a pause, whatever the action", () => {
    for (const action of [
      "sign-in",
      "sign-up",
      "request-reset",
      "reset",
    ] as const) {
      expect(authFormError({ status: 429 }, action)).toEqual({
        message: RATE_LIMITED,
      });
    }
    expect(RATE_LIMITED).toMatch(/wait a minute/i);
  });

  it("puts a wrong password on the password field", () => {
    expect(
      authFormError(
        { status: 401, code: "INVALID_EMAIL_OR_PASSWORD" },
        "sign-in"
      )
    ).toMatchObject({ field: "password" });
  });

  it("sends an existing account to sign in, on the email field", () => {
    const error = authFormError(
      { status: 422, code: "USER_ALREADY_EXISTS" },
      "sign-up"
    );
    expect(error.field).toBe("email");
    expect(error.message).toMatch(/sign in/i);
  });

  it("explains an expired reset link without blaming a field", () => {
    const error = authFormError({ code: "INVALID_TOKEN" }, "reset");
    expect(error.field).toBeUndefined();
    expect(error.message).toMatch(/expired|already used/);
  });

  it("falls back to a sentence per action", () => {
    expect(authFormError({}, "request-reset").message).toMatch(/reset link/);
  });
});

describe("currencyFromAcceptLanguage", () => {
  it("maps the first region Paystack settles in", () => {
    expect(currencyFromAcceptLanguage("en-NG,en;q=0.9")).toBe("NGN");
    expect(currencyFromAcceptLanguage("en-US,en-GH;q=0.8")).toBe("GHS");
    expect(currencyFromAcceptLanguage("sw-KE")).toBe("KES");
    expect(currencyFromAcceptLanguage("af-ZA")).toBe("ZAR");
  });

  it("gives dollars to everyone else", () => {
    expect(currencyFromAcceptLanguage("en-GB")).toBe("USD");
    expect(currencyFromAcceptLanguage(null)).toBe("USD");
  });
});

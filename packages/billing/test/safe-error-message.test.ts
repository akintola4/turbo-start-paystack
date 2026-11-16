import { describe, expect, it } from "vitest";

import { safeErrorMessage } from "../src/webhook/process";

// Hard rule 4: log causes, never query parameters.
describe("safeErrorMessage", () => {
  it("drops the parameters from a Drizzle query error", () => {
    const error = new Error(
      'Failed query: insert into "billing_customer" values ($1) params: ada@kolalogistics.test,CUS_secret'
    );
    Object.assign(error, {
      cause: { code: "23505", table: "billing_customer" },
    });
    const message = safeErrorMessage(error);
    expect(message).toBe(
      "database query failed (code 23505, table billing_customer)"
    );
    expect(message).not.toContain("ada@");
  });

  it("keeps ordinary messages", () => {
    expect(safeErrorMessage(new Error("Paystack 503"))).toBe("Paystack 503");
  });
});

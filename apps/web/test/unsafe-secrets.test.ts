import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOCK_SECRET_KEY, unsafeSecrets } from "@workspace/env/unsafe-secrets";
import { describe, expect, it } from "vitest";

const SAFE = {
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://app.example.com",
  BETTER_AUTH_SECRET: "a".repeat(40),
  BILLING_ENCRYPTION_KEY: "0".repeat(64),
  CRON_SECRET: "b".repeat(24),
  PAYSTACK_SECRET_KEY: "sk_live_realkey",
};

function exampleEnv(): Record<string, string> {
  const text = readFileSync(join(__dirname, "../../../.env.example"), "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)];
      })
  );
}

describe("unsafeSecrets", () => {
  it("passes a real deployment", () => {
    expect(unsafeSecrets(SAFE)).toEqual([]);
  });

  it("refuses every .env.example placeholder", () => {
    const problems = unsafeSecrets({
      ...exampleEnv(),
      ...{ NODE_ENV: "development" },
    });
    for (const key of [
      "BETTER_AUTH_SECRET",
      "BILLING_ENCRYPTION_KEY",
      "CRON_SECRET",
      "PAYSTACK_SECRET_KEY",
    ]) {
      expect(problems.join("\n")).toContain(key);
    }
  });

  it("refuses the mock key and a local Paystack URL on a public deployment", () => {
    const problems = unsafeSecrets({
      ...SAFE,
      PAYSTACK_SECRET_KEY: MOCK_SECRET_KEY,
      PAYSTACK_API_URL: "http://localhost:4010",
    });
    expect(problems).toHaveLength(2);
  });

  it("allows the mock in development and in next start on localhost", () => {
    const mock = {
      ...SAFE,
      PAYSTACK_SECRET_KEY: MOCK_SECRET_KEY,
      PAYSTACK_API_URL: "http://localhost:4010",
    };
    expect(unsafeSecrets({ ...mock, NODE_ENV: "development" })).toEqual([]);
    expect(
      unsafeSecrets({ ...mock, BETTER_AUTH_URL: "http://localhost:3000" })
    ).toEqual([]);
  });
});

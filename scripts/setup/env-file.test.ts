import { describe, expect, it } from "vitest";

import {
  applyEnv,
  fromTemplate,
  generateSecrets,
  isPlaceholder,
  parseEnv,
  planEnv,
} from "./env-file";

const TEMPLATE = `# Postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:3000
PAYSTACK_SECRET_KEY=sk_test_replace_me
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_replace_me
# PAYSTACK_API_URL=http://localhost:4010
BILLING_ENCRYPTION_KEY=replace-with-64-hex-characters
CRON_SECRET=
EMAIL_FROM=Turbo Start <noreply@example.com>
`;

describe("env file", () => {
  it("parses values, skipping comments and stripping quotes", () => {
    const env = parseEnv(`${TEMPLATE}QUOTED="a b"\n`);
    expect(env.get("BETTER_AUTH_URL")).toBe("http://localhost:3000");
    expect(env.has("PAYSTACK_API_URL")).toBe(false);
    expect(env.get("QUOTED")).toBe("a b");
    expect(env.get("CRON_SECRET")).toBe("");
  });

  it("treats blanks and template values as placeholders, real values not", () => {
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("replace-with-64-hex-characters")).toBe(true);
    expect(isPlaceholder("sk_test_replace_me")).toBe(true);
    expect(isPlaceholder("sk_test_abc123")).toBe(false);
    expect(isPlaceholder("http://localhost:3000")).toBe(false);
  });

  it("fills only blanks and placeholders, never an existing value", () => {
    const current = parseEnv(
      TEMPLATE.replace(
        "BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters",
        "BETTER_AUTH_SECRET=my-own-secret-that-is-long-enough-123"
      ).replace("sk_test_replace_me", "sk_test_realkey")
    );
    const plan = planEnv(current, {
      BETTER_AUTH_SECRET: "generated",
      BETTER_AUTH_URL: "http://localhost:3005",
      PAYSTACK_SECRET_KEY: "sk_test_local_mock",
      CRON_SECRET: "generated-cron",
      PAYSTACK_API_URL: "http://localhost:4010",
    });
    expect(plan.updates).toEqual({
      CRON_SECRET: "generated-cron",
      PAYSTACK_API_URL: "http://localhost:4010",
    });
    expect(plan.kept.sort()).toEqual([
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "PAYSTACK_SECRET_KEY",
    ]);
  });

  it("overwrites only keys it was told it owns (a template it just copied)", () => {
    const plan = planEnv(
      parseEnv(TEMPLATE),
      { BETTER_AUTH_URL: "http://localhost:3005" },
      new Set(["BETTER_AUTH_URL"])
    );
    expect(plan.updates).toEqual({ BETTER_AUTH_URL: "http://localhost:3005" });
  });

  it("is idempotent: a second run has nothing to fill", () => {
    const desired = {
      ...generateSecrets(),
      PAYSTACK_API_URL: "http://localhost:4010",
    };
    const first = applyEnv(
      TEMPLATE,
      planEnv(parseEnv(TEMPLATE), desired).updates
    );
    const second = planEnv(parseEnv(first), {
      ...generateSecrets(),
      PAYSTACK_API_URL: "x",
    });
    expect(second.updates).toEqual({});
  });

  it("writes in place, uncomments, appends, and keeps other lines", () => {
    const out = applyEnv(TEMPLATE, {
      CRON_SECRET: "abc",
      PAYSTACK_API_URL: "http://localhost:4010",
      PAYSTACK_MOCK_PORT: "4010",
      EMAIL_FROM: "Acme <a@b.test>",
    });
    expect(out).toContain("CRON_SECRET=abc\n");
    expect(out).toContain("PAYSTACK_API_URL=http://localhost:4010\n");
    expect(out).not.toContain("# PAYSTACK_API_URL");
    expect(out).toContain('EMAIL_FROM="Acme <a@b.test>"');
    expect(out).toMatch(
      /# Local development \(pnpm setup\)\nPAYSTACK_MOCK_PORT=4010\n$/
    );
    expect(out).toContain("# Postgres\n");
    expect(parseEnv(out).get("EMAIL_FROM")).toBe("Acme <a@b.test>");
  });

  it("generates secrets in the formats the app validates", () => {
    const s = generateSecrets();
    expect(s.BETTER_AUTH_SECRET?.length).toBeGreaterThanOrEqual(32);
    expect(s.BILLING_ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(s.CRON_SECRET?.length).toBeGreaterThanOrEqual(16);
    expect(generateSecrets().BETTER_AUTH_SECRET).not.toBe(s.BETTER_AUTH_SECRET);
  });
});

describe("a new apps/web/.env from the template", () => {
  it("replaces the copy-me header and keeps every value line", () => {
    const template = `# Copy to apps/web/.env and fill in. Placeholder values only.

${TEMPLATE}`;
    const out = fromTemplate(template);
    expect(out).not.toContain("Copy to apps/web/.env");
    expect(out).not.toContain("Placeholder values only");
    expect(out.split("\n")[0]).toContain("Written by `pnpm setup`");
    expect(out.endsWith(TEMPLATE)).toBe(true);
  });
});

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },

  server: {
    DATABASE_URL: z.url(),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),

    // sk_test_… or sk_live_…. Also the webhook HMAC key.
    PAYSTACK_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
    // Override only to point at scripts/paystack-mock.ts in local dev/tests.
    PAYSTACK_API_URL: z.url().default("https://api.paystack.co"),
    PAYSTACK_WEBHOOK_IP_ALLOWLIST: booleanString,

    // 32 bytes as 64 hex chars. Encrypts email_token and authorization_code.
    BILLING_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i),
    BILLING_GRACE_DAYS: z.coerce.number().int().min(0).default(7),
    BILLING_CURRENCY: z
      .enum(["NGN", "GHS", "ZAR", "KES", "USD"])
      .default("NGN"),
    // card: card-up-front trial on plans with trialDays. off: no trials.
    BILLING_TRIAL_MODE: z.enum(["card", "off"]).default("card"),

    // Bearer token for /api/cron/*.
    CRON_SECRET: z.string().min(16),

    EMAIL_FROM: z.string().min(3).default("Turbo Start <noreply@example.com>"),
    // Optional: without it, emails are logged (development only).
    RESEND_API_KEY: z.string().min(1).optional(),
    // "log" lets a local production build (next start) log emails instead of
    // sending them. Never set it on a real deployment.
    EMAIL_TRANSPORT: z.enum(["resend", "log"]).optional(),
  },

  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.SKIP_ENV_VALIDATION === "true",

  emptyStringAsUndefined: true,
});

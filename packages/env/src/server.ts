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
    // Header the hosting platform's proxy writes the client IP into. Only
    // its right-most entry is trusted. Vercel: x-vercel-forwarded-for.
    // Behind another proxy: x-forwarded-for (if it appends), x-real-ip,
    // cf-connecting-ip, and so on.
    CLIENT_IP_HEADER: z
      .string()
      .regex(/^[a-z0-9-]+$/i)
      .transform((value) => value.toLowerCase())
      .default(
        process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for"
      ),

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
    // Branding for the email templates (packages/email/src/theme.ts).
    EMAIL_BRAND_NAME: z.string().min(1).default("Turbo Start"),
    // Absolute https URL of a logo (~56px tall). Without it, a wordmark.
    EMAIL_LOGO_URL: z.url({ protocol: /^https$/ }).optional(),
    // "Contact support" link in the footer (https: or mailto:).
    EMAIL_SUPPORT_URL: z.url({ protocol: /^(https|mailto)$/ }).optional(),

    // The seller printed on invoices. All optional: the name falls back to
    // EMAIL_BRAND_NAME and empty fields are left off. Copied onto each
    // invoice when it is issued, so changing them never edits old ones.
    INVOICE_SELLER_NAME: z.string().min(1).optional(),
    // Postal address; write line breaks as \n.
    INVOICE_SELLER_ADDRESS: z.string().min(1).optional(),
    INVOICE_SELLER_EMAIL: z.email().optional(),
    // Company registration or tax ID, e.g. "RC 1234567" or "TIN 12345678-0001".
    INVOICE_SELLER_TAX_ID: z.string().min(1).optional(),
    INVOICE_SELLER_VAT_NUMBER: z.string().min(1).optional(),
    // VAT included in your prices, as a percentage: 7.5 in Nigeria. 0 (the
    // default) prints no VAT lines.
    INVOICE_VAT_RATE: z
      .string()
      .regex(/^(100|\d{1,2})(\.\d{1,2})?$/, "a percentage like 7.5")
      .optional(),
  },

  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.SKIP_ENV_VALIDATION === "true",

  emptyStringAsUndefined: true,
});

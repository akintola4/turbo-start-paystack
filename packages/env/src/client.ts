import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    // pk_test_… or pk_live_…. Used by @paystack/inline-js in the browser.
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z
      .string()
      .regex(/^pk_(test|live)_/)
      .optional(),
  },

  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.SKIP_ENV_VALIDATION === "true",

  emptyStringAsUndefined: true,
});

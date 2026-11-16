/**
 * Secrets that pass the shape checks in server.ts but must never run a real
 * deployment: the placeholders from .env.example, and the local mock's
 * public Paystack key. Whoever knows the auth secret can sign Better Auth
 * tokens, and whoever knows the Paystack key can forge webhooks.
 */

const PLACEHOLDER_KEYS = [
  "BETTER_AUTH_SECRET",
  "BILLING_ENCRYPTION_KEY",
  "CRON_SECRET",
  "PAYSTACK_SECRET_KEY",
] as const;

/** The secret key `pnpm setup` writes for the bundled mock. It is public. */
export const MOCK_SECRET_KEY = "sk_test_local_mock";

function isPlaceholder(value: string): boolean {
  return value.startsWith("replace-") || value === "sk_test_replace_me";
}

function isLocalUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  try {
    const host = new URL(value).hostname;
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
  } catch {
    return false;
  }
}

type Values = Partial<Record<string, string | undefined>>;

/** Returns one message per unsafe value; empty when the env is fine. */
export function unsafeSecrets(values: Values): string[] {
  const problems: string[] = [];
  for (const key of PLACEHOLDER_KEYS) {
    const value = values[key];
    if (value && isPlaceholder(value)) {
      problems.push(
        `${key} is still the .env.example placeholder. Generate a real value.`
      );
    }
  }
  // A production build served from a public URL. `next start` on
  // localhost against the mock stays allowed.
  const deployed =
    values.NODE_ENV === "production" && !isLocalUrl(values.BETTER_AUTH_URL);
  if (deployed && values.PAYSTACK_SECRET_KEY === MOCK_SECRET_KEY) {
    problems.push(
      `PAYSTACK_SECRET_KEY is the local mock's public key (${MOCK_SECRET_KEY}). Use your Paystack secret key.`
    );
  }
  if (deployed && isLocalUrl(values.PAYSTACK_API_URL)) {
    problems.push(
      "PAYSTACK_API_URL points at the local mock. Remove it so the app talks to Paystack."
    );
  }
  return problems;
}

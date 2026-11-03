// Where the local scripts send things, kept pure so the rules are tested.

/** An http(s) URL on this machine. */
export function isLocalUrl(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
      new URL(url).hostname
    );
  } catch {
    return false;
  }
}

/** What `pnpm billing:sync` is about to talk to. */
export function paystackModeLabel(
  secretKey: string,
  apiUrl: string | undefined
): "LIVE" | "test" | "mock" {
  if (apiUrl && isLocalUrl(apiUrl)) {
    return "mock";
  }
  return secretKey.startsWith("sk_live_") ? "LIVE" : "test";
}

/**
 * The webhook URL `pnpm webhook:replay` posts to. Without `--url=` it is
 * BETTER_AUTH_URL's webhook route, but only when that is local: an
 * apps/web/.env pulled from Vercel would otherwise send a correctly signed
 * fake event to a real deployment. A live key never goes anywhere but
 * localhost.
 */
export function replayTarget(
  argv: string[],
  env: Record<string, string | undefined>
): { url: string } | { error: string } {
  const explicit = argv
    .find((a) => a.startsWith("--url="))
    ?.slice("--url=".length);
  const url =
    explicit ||
    `${(env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/api/webhooks/paystack`;
  if (isLocalUrl(url)) {
    return { url };
  }
  if (env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")) {
    return {
      error: `Refusing to send a webhook signed with a live key to ${url}. Replay only targets localhost with sk_live_ keys.`,
    };
  }
  if (!explicit) {
    return {
      error: `BETTER_AUTH_URL (${env.BETTER_AUTH_URL}) isn't local. Pass --url=<webhook url> to send there on purpose.`,
    };
  }
  return { url };
}

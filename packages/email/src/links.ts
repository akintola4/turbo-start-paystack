/**
 * Links in emails are never taken from user input. App links are built from
 * the configured app URL; URLs handed to us by Better Auth must be on that
 * origin; Paystack links must be https on a Paystack host.
 */

export class UnsafeLinkError extends Error {}

function parse(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new UnsafeLinkError("Email links must be absolute URLs");
  }
}

/** Absolute http(s) origin of the app, without a trailing slash. */
export function normalizeAppUrl(appUrl: string): string {
  const url = parse(appUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeLinkError("App URL must be http(s)");
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/** `/app/acme/settings/billing` → `https://app.example.com/app/acme/...`.
 *  Each path segment is URL-encoded, so a slug can't change the path. */
export function appLink(appUrl: string, segments: string[]): string {
  const base = normalizeAppUrl(appUrl);
  return `${base}/${segments.map((s) => encodeURIComponent(s)).join("/")}`;
}

/** Accepts a URL only if it is on the app's origin (Better Auth builds
 *  verification and reset links from the same base URL). */
export function requireAppOrigin(url: string, appUrl: string): string {
  const parsed = parse(url);
  if (parsed.origin !== parse(appUrl).origin) {
    throw new UnsafeLinkError(
      `Link is not on the app origin: ${parsed.origin}`
    );
  }
  return parsed.toString();
}

const PAYSTACK_HOSTS = ["paystack.com", "paystack.co"];

/**
 * A Paystack-hosted link (e.g. the manage-card page) if it is https on a
 * Paystack domain or on one of `extraOrigins` (the local mock). Otherwise
 * null, and the caller falls back to an app link.
 */
export function paystackLink(
  url: string | undefined,
  extraOrigins: readonly string[] = []
): string | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (extraOrigins.includes(parsed.origin)) {
    return parsed.toString();
  }
  const host = parsed.hostname;
  const onPaystack = PAYSTACK_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
  return parsed.protocol === "https:" && onPaystack ? parsed.toString() : null;
}

/** Strips line breaks so user text (an org name) can't fold a subject. */
export function oneLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

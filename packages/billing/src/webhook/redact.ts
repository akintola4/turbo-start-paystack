import { decryptSecret, encryptSecret } from "../crypto";

/**
 * Paystack payload fields that act as credentials: `authorization_code`
 * charges the card again, `email_token` disables or enables a subscription,
 * `access_code` resumes a checkout. They are kept out of stored payloads in
 * plain text.
 */
const SECRET_KEYS = new Set([
  "authorization_code",
  "email_token",
  "access_code",
]);
const SECRET_PATTERN = /(^|_)(token|secret|password)$/i;

export const REDACTED = "[redacted]";

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key) || SECRET_PATTERN.test(key);
}

function mapSecrets(
  value: unknown,
  replace: (secret: string) => string
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mapSecrets(item, replace));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSecretKey(key) && typeof inner === "string"
          ? replace(inner)
          : mapSecrets(inner, replace),
      ])
    );
  }
  return value;
}

const SEALED = /^v1:[^:]+:[^:]+:[^:]+$/;

/** Replaces each secret with `[redacted]`. For copies nothing reads back,
 *  such as `invoice.raw`. */
export function redactSecrets<T>(value: T): T {
  return mapSecrets(value, () => REDACTED) as T;
}

/** Encrypts each secret in place (same AES-GCM key as the subscription
 *  columns), so a stored webhook can still be processed or retried later.
 *  Values that are already sealed or redacted are left alone. */
export function sealSecrets<T>(value: T, keyHex: string): T {
  return mapSecrets(value, (secret) =>
    secret === REDACTED || SEALED.test(secret)
      ? secret
      : encryptSecret(secret, keyHex)
  ) as T;
}

/** The inverse of `sealSecrets`, for processing. Plain values (events stored
 *  before sealing existed) pass through. */
export function unsealSecrets<T>(value: T, keyHex: string): T {
  return mapSecrets(value, (secret) =>
    SEALED.test(secret) ? decryptSecret(secret, keyHex) : secret
  ) as T;
}

/** True if any secret field in `value` holds a plain-text value. */
export function hasPlainSecrets(value: unknown): boolean {
  let found = false;
  mapSecrets(value, (secret) => {
    if (secret !== REDACTED && !SEALED.test(secret)) {
      found = true;
    }
    return secret;
  });
  return found;
}

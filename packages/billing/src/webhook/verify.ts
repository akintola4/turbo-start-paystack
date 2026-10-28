import { createHmac, timingSafeEqual } from "node:crypto";

/** Paystack's published webhook source IPs (same for test and live). */
export const PAYSTACK_WEBHOOK_IPS = [
  "52.31.139.75",
  "52.49.173.169",
  "52.214.14.220",
] as const;

export function signPaystackPayload(
  rawBody: string,
  secretKey: string
): string {
  return createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");
}

/**
 * `x-paystack-signature` is the hex HMAC-SHA512 of the exact raw body, keyed
 * with the secret key. Compared in constant time; a wrong-length or non-hex
 * signature is rejected without throwing.
 */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null | undefined,
  secretKey: string
): boolean {
  if (!(signature && secretKey)) {
    return false;
  }
  const expected = Buffer.from(signPaystackPayload(rawBody, secretKey), "hex");
  const given = Buffer.from(signature.trim().toLowerCase(), "hex");
  if (given.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(expected, given);
}

export function isPaystackIp(ip: string | null | undefined): boolean {
  if (!ip) {
    return false;
  }
  const normalized = ip.replace(/^::ffff:/, "").trim();
  return (PAYSTACK_WEBHOOK_IPS as readonly string[]).includes(normalized);
}

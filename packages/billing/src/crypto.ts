import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyFrom(hex: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("BILLING_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return key;
}

/** AES-256-GCM. Output: `v1:<iv>:<tag>:<ciphertext>`, each base64. Used for
 *  Paystack `email_token` and `authorization_code` at rest. */
export function encryptSecret(plain: string, keyHex: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyHex), iv, {
    authTagLength: TAG_BYTES,
  });
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data]
    .map((part) => (typeof part === "string" ? part : part.toString("base64")))
    .join(":");
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Strict base64 decode: Node's decoder skips junk instead of failing. */
function base64(part: string | undefined): Buffer | null {
  if (!(part && BASE64.test(part) && part.length % 4 === 0)) {
    return null;
  }
  return Buffer.from(part, "base64");
}

export function decryptSecret(payload: string, keyHex: string): string {
  const parts = payload.split(":");
  const [version, ivPart, tagPart, dataPart] = parts;
  const iv = base64(ivPart);
  const tag = base64(tagPart);
  const data = base64(dataPart);
  // A shorter GCM tag would be accepted by Node and is far easier to forge.
  if (
    parts.length !== 4 ||
    version !== VERSION ||
    iv?.length !== IV_BYTES ||
    tag?.length !== TAG_BYTES ||
    !data
  ) {
    throw new Error("Unrecognised encrypted value");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(keyHex), iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

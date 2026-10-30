import { createHash, randomUUID } from "node:crypto";
import { type Database, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { sealSecrets } from "./redact";
import { isPaystackIp, verifyPaystackSignature } from "./verify";

export type IngestResult =
  | { status: 401; reason: "bad_signature" | "ip_not_allowed" }
  | { status: 400; reason: "invalid_payload" }
  | { status: 200; eventId: string; duplicate: boolean };

/**
 * Step one of webhook handling: authenticate, then persist exactly once.
 * Processing happens afterwards (see `processEvent`), so a handler bug never
 * turns into a non-200 and a Paystack retry storm. Only a failure to persist
 * should surface as 5xx, and that is left to throw.
 */
export async function ingestWebhook(input: {
  db: Database;
  rawBody: string;
  signature: string | null;
  secretKey: string;
  /** Seals authorization codes and email tokens inside the stored payload. */
  encryptionKey: string;
  ip?: string | null;
  enforceIpAllowlist?: boolean;
}): Promise<IngestResult> {
  if (input.enforceIpAllowlist && !isPaystackIp(input.ip)) {
    return { status: 401, reason: "ip_not_allowed" };
  }
  if (
    !verifyPaystackSignature(input.rawBody, input.signature, input.secretKey)
  ) {
    return { status: 401, reason: "bad_signature" };
  }

  let payload: { event?: unknown; data?: unknown };
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, reason: "invalid_payload" };
  }
  if (typeof payload?.event !== "string") {
    return { status: 400, reason: "invalid_payload" };
  }

  // Paystack retries resend the identical body, so its hash is a stable key.
  // Hashed before the secrets are sealed: sealing is randomised.
  const dedupeKey = createHash("sha256").update(input.rawBody).digest("hex");
  const inserted = await input.db
    .insert(schema.webhookEvent)
    .values({
      id: randomUUID(),
      provider: "paystack",
      eventType: payload.event,
      dedupeKey,
      payload: sealSecrets(payload, input.encryptionKey),
    })
    .onConflictDoNothing({ target: schema.webhookEvent.dedupeKey })
    .returning({ id: schema.webhookEvent.id });

  if (inserted[0]) {
    return { status: 200, eventId: inserted[0].id, duplicate: false };
  }
  const [existing] = await input.db
    .select({ id: schema.webhookEvent.id })
    .from(schema.webhookEvent)
    .where(eq(schema.webhookEvent.dedupeKey, dedupeKey));
  return { status: 200, eventId: existing?.id ?? "", duplicate: true };
}

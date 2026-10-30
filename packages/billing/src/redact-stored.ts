import { type Database, schema } from "@workspace/db";
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";

import { hasPlainSecrets, redactSecrets, sealSecrets } from "./webhook/redact";

/**
 * One-off clean-up for rows stored before payload secrets were sealed:
 * seals plain `authorization_code` / `email_token` / `access_code` values in
 * `webhook_event.payload` (so unprocessed events can still be processed) and
 * redacts them in `invoice.raw`. Safe to re-run; rows already clean are
 * skipped. `dedupe_key` is untouched: it is the hash of the original body.
 */
export async function redactStoredPayloads(
  db: Database,
  encryptionKey: string,
  batchSize = 200
) {
  const report = { webhookEvents: 0, invoices: 0 };

  let after = "";
  for (;;) {
    const rows = await db
      .select({
        id: schema.webhookEvent.id,
        payload: schema.webhookEvent.payload,
      })
      .from(schema.webhookEvent)
      .where(gt(schema.webhookEvent.id, after))
      .orderBy(asc(schema.webhookEvent.id))
      .limit(batchSize);
    for (const row of rows) {
      if (hasPlainSecrets(row.payload)) {
        await db
          .update(schema.webhookEvent)
          .set({ payload: sealSecrets(row.payload, encryptionKey) })
          .where(eq(schema.webhookEvent.id, row.id));
        report.webhookEvents += 1;
      }
    }
    if (rows.length < batchSize) {
      break;
    }
    after = rows.at(-1)?.id ?? after;
  }

  after = "";
  for (;;) {
    const rows = await db
      .select({ id: schema.invoice.id, raw: schema.invoice.raw })
      .from(schema.invoice)
      .where(and(isNotNull(schema.invoice.raw), gt(schema.invoice.id, after)))
      .orderBy(asc(schema.invoice.id))
      .limit(batchSize);
    for (const row of rows) {
      if (hasPlainSecrets(row.raw)) {
        await db
          .update(schema.invoice)
          .set({ raw: redactSecrets(row.raw) })
          .where(eq(schema.invoice.id, row.id));
        report.invoices += 1;
      }
    }
    if (rows.length < batchSize) {
      break;
    }
    after = rows.at(-1)?.id ?? after;
  }
  return report;
}

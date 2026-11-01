import { type DbOrTx, schema } from "@workspace/db";
import { and, eq, like, sql } from "drizzle-orm";

import { type RefundState, refundState } from "../refund-state";
import type { BillingDeps } from "./context";

type InvoiceRow = typeof schema.invoice.$inferSelect;

/**
 * Writes a void row's refund state, derived from its request date and every
 * `refund.*` webhook stored for the charge. Called after the refund request
 * and on each refund webhook, so a webhook that beat the row being written
 * still counts. `refunded_at` is when we first saw `processed`.
 * Returns the row for `reference` (any status, or null) and the state; only
 * a void row is written.
 */
export async function syncRefundState(
  deps: Pick<BillingDeps, "now">,
  tx: DbOrTx,
  reference: string,
  incoming?: string
): Promise<{ row: InvoiceRow | null; state: RefundState }> {
  const [row] = await tx
    .select()
    .from(schema.invoice)
    .where(eq(schema.invoice.reference, reference))
    .for("update");
  const events = await refundEvents(tx, reference);
  const state = refundState({
    requested: Boolean(row?.refundRequestedAt),
    events: incoming ? [incoming, ...events] : events,
  });
  if (!row || row.status !== "void") {
    return { row: row ?? null, state };
  }
  const refundedAt =
    state === "processed" ? (row.refundedAt ?? deps.now()) : null;
  if (
    state !== row.refundStatus ||
    refundedAt?.getTime() !== row.refundedAt?.getTime()
  ) {
    await tx
      .update(schema.invoice)
      .set({ refundStatus: state, refundedAt })
      .where(eq(schema.invoice.id, row.id));
  }
  return { row: { ...row, refundStatus: state, refundedAt }, state };
}

async function refundEvents(tx: DbOrTx, reference: string) {
  const stored = await tx
    .select({ eventType: schema.webhookEvent.eventType })
    .from(schema.webhookEvent)
    .where(
      and(
        like(schema.webhookEvent.eventType, "refund.%"),
        sql`${schema.webhookEvent.payload}->'data'->>'transaction_reference' = ${reference}`
      )
    );
  return stored.map((e) => e.eventType);
}

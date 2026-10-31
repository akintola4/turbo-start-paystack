import { schema } from "@workspace/db";
import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";

import {
  type BillingDeps,
  type Outcome,
  transactionWithNotifications,
} from "../service/context";
import { dispatchEvent } from "./handlers";
import { unsealSecrets } from "./redact";

export const MAX_EVENT_ATTEMPTS = 10;

/**
 * Processes one stored webhook event. Never throws: failures are written to
 * the event row (`error`, `attempts`) and reconcile retries events whose
 * `processed_at` is still null.
 */
export async function processEvent(
  deps: BillingDeps,
  eventId: string
): Promise<Outcome & { skipped?: boolean }> {
  try {
    return await transactionWithNotifications(deps, async (tx, scoped) => {
      const [event] = await tx
        .select()
        .from(schema.webhookEvent)
        .where(eq(schema.webhookEvent.id, eventId))
        .for("update", { skipLocked: true });
      if (!event || event.processedAt) {
        return { skipped: true };
      }
      const payload = unsealSecrets(
        event.payload as { event: string; data: unknown },
        deps.encryptionKey
      );
      const outcome = await dispatchEvent(
        scoped,
        tx,
        payload.event,
        payload.data
      );
      await tx
        .update(schema.webhookEvent)
        .set({
          attempts: event.attempts + 1,
          error: outcome.error ?? null,
          processedAt: outcome.retry ? null : deps.now(),
        })
        .where(eq(schema.webhookEvent.id, eventId));
      if (outcome.error) {
        deps.logger.warn(`webhook ${payload.event} handled with error`, {
          eventId,
          error: outcome.error,
          retry: Boolean(outcome.retry),
        });
      }
      return outcome;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logger.error("webhook processing failed", {
      eventId,
      error: message,
      ...dbErrorCause(error),
    });
    await deps.db
      .update(schema.webhookEvent)
      .set({
        attempts: sql`${schema.webhookEvent.attempts} + 1`,
        error: message.slice(0, 1000),
      })
      .where(eq(schema.webhookEvent.id, eventId));
    return { error: message, retry: true };
  }
}

/** Retries unprocessed events, oldest first. */
export async function processPending(deps: BillingDeps, limit = 50) {
  const pending = await deps.db
    .select({ id: schema.webhookEvent.id })
    .from(schema.webhookEvent)
    .where(
      and(
        isNull(schema.webhookEvent.processedAt),
        lt(schema.webhookEvent.attempts, MAX_EVENT_ATTEMPTS)
      )
    )
    .orderBy(asc(schema.webhookEvent.receivedAt))
    .limit(limit);
  let processed = 0;
  for (const { id } of pending) {
    const outcome = await processEvent(deps, id);
    if (!(outcome.retry || outcome.skipped)) {
      processed += 1;
    }
  }
  return { attempted: pending.length, processed };
}

/**
 * Postgres's reason for a failed query (Drizzle wraps it as `cause`): the
 * SQLSTATE code, constraint and table. Never the parameter values, which can
 * hold payment data.
 */
export function dbErrorCause(error: unknown) {
  const cause = (error as { cause?: Record<string, unknown> } | null)?.cause;
  if (!cause || typeof cause !== "object") {
    return {};
  }
  const pick = (key: string) =>
    typeof cause[key] === "string" ? (cause[key] as string) : undefined;
  return {
    code: pick("code"),
    constraint: pick("constraint") ?? pick("constraint_name"),
    table: pick("table") ?? pick("table_name"),
  };
}

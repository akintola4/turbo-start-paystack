import { randomUUID } from "node:crypto";
import { type DbOrTx, schema } from "@workspace/db";
import { sql } from "drizzle-orm";

export type RateLimitRule = {
  /** Seconds. */
  window: number;
  max: number;
};

/** Per-user limits on the app's own routes (Better Auth limits its own). */
export const USER_RATE_LIMITS = {
  /** POST /api/orgs/:orgId/billing/* and /settings/*. */
  orgMutation: { window: 60, max: 20 },
  /** GET …/invoices/:id/pdf: each one renders a PDF. */
  invoicePdf: { window: 60, max: 20 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Counts one request against `key` in the shared `rate_limit` table, in a
 * single statement so concurrent requests on any instance cannot all slip
 * through. The window is fixed: it starts with the first request and resets
 * once it has passed.
 */
export async function consumeRateLimit(
  db: DbOrTx,
  key: string,
  rule: RateLimitRule,
  now = Date.now()
): Promise<{ allowed: boolean; retryAfter: number }> {
  const t = schema.rateLimit;
  const windowStart = now - rule.window * 1000;
  const [row] = await db
    .insert(t)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`case when ${t.lastRequest} <= ${windowStart} then 1 else ${t.count} + 1 end`,
        lastRequest: sql`case when ${t.lastRequest} <= ${windowStart} then ${now} else ${t.lastRequest} end`,
      },
    })
    .returning({ count: t.count, lastRequest: t.lastRequest });
  if (!row) {
    throw new Error("rate limit upsert did not return a row");
  }
  return {
    allowed: row.count <= rule.max,
    retryAfter: Math.max(
      1,
      Math.ceil((row.lastRequest + rule.window * 1000 - now) / 1000)
    ),
  };
}

/** A 429 for `key` when it is over `rule`, else null. Keys are per user:
 *  `user:<id>|<bucket>`. */
export async function userRateLimit(
  db: DbOrTx,
  userId: string,
  bucket: keyof typeof USER_RATE_LIMITS,
  now?: number
): Promise<Response | null> {
  const { allowed, retryAfter } = await consumeRateLimit(
    db,
    `user:${userId}|${bucket}`,
    USER_RATE_LIMITS[bucket],
    now
  );
  if (allowed) {
    return null;
  }
  return Response.json(
    {
      error: "rate_limited",
      message: "Too many requests. Wait a minute, then try again.",
    },
    { status: 429, headers: { "retry-after": String(retryAfter) } }
  );
}

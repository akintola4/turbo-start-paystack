import { AuthError } from "@workspace/auth/permissions";
import type { AuthService } from "@workspace/auth/server";
import type { BillingService, ReconcileReport } from "@workspace/billing";
import type { Delivery, SimulateAction } from "@workspace/billing/simulate";
import { type Database, schema } from "@workspace/db";
import { type DevOutboxEntry, textToHtml } from "@workspace/email";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

/**
 * The "Simulate billing" dev panel's server side. It never writes billing
 * state: it asks the local Paystack mock to emit signed webhooks (which go
 * through the real webhook route and handlers), waits for them to be
 * processed, then runs reconcile, as the hourly cron would.
 *
 * Available only outside production and only while PAYSTACK_API_URL points
 * at a mock on this machine. Otherwise every route answers 404.
 */

export const DEV_ACTIONS = [
  "renew",
  "fail",
  "recover",
  "end-trial",
  "duplicate",
  "forged",
] as const;
export type DevAction = (typeof DEV_ACTIONS)[number];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True for the local mock (`http://localhost:4010`), never for Paystack. */
export function isLocalMockUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function devToolsEnabled(env: {
  NODE_ENV?: string;
  PAYSTACK_API_URL?: string;
  PAYSTACK_SECRET_KEY?: string;
}): boolean {
  return (
    env.NODE_ENV !== "production" &&
    isLocalMockUrl(env.PAYSTACK_API_URL) &&
    !env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")
  );
}

export type MockResult =
  | { ok: true; deliveries: Delivery[] }
  | { ok: false; status: number; error: string; message: string };

/** Calls the mock's POST /__dev/simulate. */
export type MockClient = (input: {
  action: SimulateAction;
  subscriptionCode: string;
}) => Promise<MockResult>;

export function createMockClient(options: {
  baseUrl: string;
  secretKey: string;
  fetch?: typeof fetch;
}): MockClient {
  const doFetch = options.fetch ?? fetch;
  return async (input) => {
    let res: Response;
    try {
      res = await doFetch(new URL("/__dev/simulate", options.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.secretKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
    } catch {
      return {
        ok: false,
        status: 502,
        error: "mock_unreachable",
        message: `The Paystack mock is not answering on ${options.baseUrl}. Start it with \`pnpm dev\`.`,
      };
    }
    const body = (await res.json().catch(() => ({}))) as {
      deliveries?: Delivery[];
      error?: string;
      message?: string;
    };
    if (!(res.ok && body.deliveries)) {
      return {
        ok: false,
        status: res.status === 409 ? 409 : 502,
        error: body.error ?? "mock_failed",
        message:
          body.message ??
          `The mock answered ${res.status}. Restart \`pnpm dev\` to pick up the latest mock.`,
      };
    }
    return { ok: true, deliveries: body.deliveries };
  };
}

export type DevDeps = {
  db: Database;
  authService: AuthService;
  billing: BillingService;
  enabled: boolean;
  mock: MockClient;
  outbox: () => readonly DevOutboxEntry[];
  /** How long to wait for the webhook route's background processing. */
  waitMs?: number;
};

export type DevLogEntry = {
  event: string;
  /** HTTP status from the webhook route, or null for a reconcile step. */
  status: number | null;
  outcome: string;
  tone: "ok" | "ignored" | "rejected" | "error";
};

const json = (body: unknown, status = 200) => Response.json(body, { status });
const notFound = () => json({ error: "not_found" }, 404);

async function authorize(
  deps: DevDeps,
  headers: Headers,
  organizationId: string
): Promise<Response | null> {
  try {
    await deps.authService.requirePermission(
      headers,
      organizationId,
      "billing:manage"
    );
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, error.status);
    }
    throw error;
  }
}

const simulateBody = z.strictObject({ action: z.enum(DEV_ACTIONS) });

/** Waits until the webhook route has processed (or failed) these events. */
async function waitForProcessing(
  db: Database,
  dedupeKeys: string[],
  timeoutMs: number
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = dedupeKeys.length
      ? await db
          .select({
            dedupeKey: schema.webhookEvent.dedupeKey,
            processedAt: schema.webhookEvent.processedAt,
            error: schema.webhookEvent.error,
          })
          .from(schema.webhookEvent)
          .where(inArray(schema.webhookEvent.dedupeKey, dedupeKeys))
      : [];
    const settled = rows.filter((r) => r.processedAt || r.error);
    if (settled.length >= dedupeKeys.length || Date.now() > deadline) {
      return rows;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

function describeDelivery(
  delivery: Delivery,
  row: { processedAt: Date | null; error: string | null } | undefined
): DevLogEntry {
  const response = (delivery.response ?? {}) as {
    duplicate?: boolean;
    error?: string;
  };
  if (delivery.status === 401) {
    return {
      event: delivery.event,
      status: 401,
      outcome: `rejected: ${response.error ?? "unauthorized"}`,
      tone: "rejected",
    };
  }
  if (delivery.status !== 200) {
    return {
      event: delivery.event,
      status: delivery.status,
      outcome: response.error ?? "failed",
      tone: "error",
    };
  }
  if (response.duplicate) {
    return {
      event: delivery.event,
      status: 200,
      outcome: "ignored: duplicate",
      tone: "ignored",
    };
  }
  if (row?.error) {
    return {
      event: delivery.event,
      status: 200,
      outcome: `error: ${row.error}`,
      tone: "error",
    };
  }
  return {
    event: delivery.event,
    status: 200,
    outcome: row?.processedAt ? "processed" : "queued",
    tone: "ok",
  };
}

function reconcileEntry(report: ReconcileReport): DevLogEntry {
  const parts = [
    report.eventsRetried && `${report.eventsRetried} events retried`,
    report.subscriptionsResynced && `${report.subscriptionsResynced} resynced`,
    report.subscriptionsExpired && `${report.subscriptionsExpired} expired`,
    report.trialRemindersSent && `${report.trialRemindersSent} trial reminders`,
  ].filter(Boolean);
  return {
    event: "reconcile",
    status: null,
    outcome:
      report.errors.length > 0
        ? `${report.errors.length} errors`
        : parts.join(", ") || "nothing to do",
    tone: report.errors.length > 0 ? "error" : "ok",
  };
}

/** POST /api/dev/orgs/:orgId/simulate */
export async function handleDevSimulate(
  deps: DevDeps,
  input: {
    headers: Headers;
    organizationId: string;
    body: unknown;
    contentType?: string | null;
  }
): Promise<Response> {
  if (!deps.enabled) {
    return notFound();
  }
  if (!input.contentType?.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const denied = await authorize(deps, input.headers, input.organizationId);
  if (denied) {
    return denied;
  }
  const parsed = simulateBody.safeParse(input.body);
  if (!parsed.success) {
    return json({ error: "invalid_body" }, 400);
  }
  const { action } = parsed.data;

  const sub = await deps.billing.getSubscription(input.organizationId);
  if (!sub?.paystackSubscriptionCode) {
    return json(
      {
        error: "no_subscription",
        message:
          "Subscribe to Starter or Pro first. The mock checkout is one click.",
      },
      409
    );
  }
  if (action === "recover" && sub.status !== "past_due") {
    return json(
      {
        error: "nothing_to_recover",
        message: "Nothing to recover. Fail a renewal first.",
      },
      409
    );
  }
  if (
    action === "end-trial" &&
    !(sub.status === "trialing" && sub.trialEndsAt)
  ) {
    return json(
      {
        error: "not_trialing",
        message: "This subscription is not on a trial.",
      },
      409
    );
  }

  const log: DevLogEntry[] = [];
  if (action === "end-trial" && sub.trialEndsAt) {
    // Reconcile's reminder step, as of two days before the trial ends.
    const sent = await deps.billing.sendTrialReminders({
      organizationId: input.organizationId,
      asOf: new Date(sub.trialEndsAt.getTime() - 2 * 86_400_000),
    });
    log.push({
      event: "reconcile: trial reminder",
      status: null,
      outcome: sent ? "trial-ending email sent" : "already sent",
      tone: sent ? "ok" : "ignored",
    });
  }

  const result = await deps.mock({
    action: action === "end-trial" ? "renew" : action,
    subscriptionCode: sub.paystackSubscriptionCode,
  });
  if (!result.ok) {
    return json(
      { error: result.error, message: result.message, log },
      result.status
    );
  }

  const fresh = result.deliveries.filter(
    (d) =>
      d.status === 200 &&
      !(d.response as { duplicate?: boolean } | null)?.duplicate
  );
  const rows = await waitForProcessing(
    deps.db,
    fresh.map((d) => d.dedupeKey),
    deps.waitMs ?? 8000
  );
  for (const delivery of result.deliveries) {
    log.push(
      describeDelivery(
        delivery,
        rows.find((r) => r.dedupeKey === delivery.dedupeKey)
      )
    );
  }
  log.push(reconcileEntry(await deps.billing.reconcile()));

  const after = await deps.billing.getSubscription(input.organizationId);
  return json({ action, log, status: after?.status ?? null });
}

/**
 * The outbox entries this caller may read for this organization: emails to
 * its members or to the caller. The outbox holds every user's mail (reset
 * and verification links included), so nothing else is shown.
 */
async function visibleOutbox(
  deps: DevDeps,
  headers: Headers,
  organizationId: string
) {
  const session = await deps.authService.auth.api.getSession({ headers });
  const members = await deps.db
    .select({ email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, organizationId));
  const allowed = new Set(
    [...members.map((m) => m.email), session?.user.email ?? ""]
      .filter(Boolean)
      .map((e) => e.toLowerCase())
  );
  return deps.outbox().filter((e) => allowed.has(e.to.toLowerCase()));
}

/** GET /api/dev/orgs/:orgId/outbox: the newest emails, without bodies. */
export async function handleDevOutbox(
  deps: DevDeps,
  input: { headers: Headers; organizationId: string; limit?: number }
): Promise<Response> {
  if (!deps.enabled) {
    return notFound();
  }
  const denied = await authorize(deps, input.headers, input.organizationId);
  if (denied) {
    return denied;
  }
  const visible = await visibleOutbox(
    deps,
    input.headers,
    input.organizationId
  );
  const emails = [...visible]
    .reverse()
    .slice(0, input.limit ?? 8)
    .map(({ id, to, subject, sentAt }) => ({ id, to, subject, sentAt }));
  return json({ emails });
}

/** GET /api/dev/orgs/:orgId/outbox/:id: one email's rendered HTML. */
export async function handleDevOutboxEmail(
  deps: DevDeps,
  input: { headers: Headers; organizationId: string; id: string }
): Promise<Response> {
  if (!deps.enabled) {
    return notFound();
  }
  const denied = await authorize(deps, input.headers, input.organizationId);
  if (denied) {
    return denied;
  }
  const visible = await visibleOutbox(
    deps,
    input.headers,
    input.organizationId
  );
  const email = visible.find((e) => e.id === input.id);
  if (!email) {
    return notFound();
  }
  return new Response(email.html ?? textToHtml(email.text), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}

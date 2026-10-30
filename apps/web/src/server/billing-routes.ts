import { AuthError } from "@workspace/auth/permissions";
import type { AuthService } from "@workspace/auth/server";
import {
  BillingError,
  type BillingService,
  ingestWebhook,
} from "@workspace/billing";
import { type Database, schema } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

export const BILLING_ACTIONS = [
  "status",
  "checkout",
  "change-plan",
  "cancel",
  "resume",
  "manage-card",
  "billing-details",
] as const;
export type BillingAction = (typeof BILLING_ACTIONS)[number];

type RouteDeps = {
  db: Database;
  authService: AuthService;
  billing: BillingService;
};

// Strict: a body that tries to set status, amount, subscription code or
// email token is rejected outright, not silently ignored (PLAN §2.3 #1/#2/#11).
const planBody = z.strictObject({ planPriceId: z.string().min(1).max(64) });
const emptyBody = z.strictObject({});
const optionalText = (max: number) => z.string().trim().max(max).nullable();
/** Who invoices are made out to. Blank fields fall back to the org name
 *  and the billing email. Never money, status or Paystack identifiers. */
export const billingDetailsBody = z.strictObject({
  legalName: optionalText(200),
  address: optionalText(500),
  taxId: optionalText(64),
  email: z.union([z.literal(""), z.email().max(254)]).nullable(),
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Subscription fields that are safe to send to the browser. Never the
 *  encrypted token or authorization code. */
export function publicSubscription(
  sub: Awaited<ReturnType<BillingService["getSubscription"]>>
) {
  if (!sub) {
    return null;
  }
  return {
    status: sub.status,
    planPriceId: sub.planPriceId,
    currency: sub.currency,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    graceUntil: sub.graceUntil,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    scheduledPlanPriceId: sub.scheduledPlanPriceId,
    card: sub.cardLast4
      ? { last4: sub.cardLast4, brand: sub.cardBrand, exp: sub.cardExp }
      : null,
  };
}

/**
 * Every billing mutation goes through here: session from headers, role from
 * the `member` row of *this* organization, then a strictly parsed body.
 */
export async function handleBillingAction(
  deps: RouteDeps,
  input: {
    headers: Headers;
    organizationId: string;
    action: string;
    body: unknown;
    /** Mutations must be JSON: cross-site HTML forms cannot send it
     *  without a CORS preflight. Defence in depth on top of SameSite. */
    contentType?: string | null;
  }
): Promise<Response> {
  if (!(BILLING_ACTIONS as readonly string[]).includes(input.action)) {
    return json({ error: "not_found" }, 404);
  }
  const action = input.action as BillingAction;
  if (
    action !== "status" &&
    !input.contentType?.toLowerCase().startsWith("application/json")
  ) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  let actor: { userId: string; email: string; emailVerified: boolean };
  try {
    actor = await deps.authService.requirePermission(
      input.headers,
      input.organizationId,
      action === "status" ? "billing:view" : "billing:manage"
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, error.status);
    }
    throw error;
  }

  try {
    return await ACTION_HANDLERS[action](deps, {
      organizationId: input.organizationId,
      actor,
      body: input.body ?? {},
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return json({ error: error.code, message: error.message }, 409);
    }
    throw error;
  }
}

type ActionContext = {
  organizationId: string;
  actor: { userId: string; email: string; emailVerified: boolean };
  body: unknown;
};

function invalid(error: z.ZodError) {
  return json({ error: "invalid_body", issues: error.issues }, 400);
}

/** Wraps a handler with strict body parsing. */
function withBody<S extends z.ZodType>(
  bodySchema: S,
  run: (
    deps: RouteDeps,
    ctx: ActionContext & { data: z.infer<S> }
  ) => Promise<Response>
) {
  return (deps: RouteDeps, ctx: ActionContext) => {
    const parsed = bodySchema.safeParse(ctx.body);
    return parsed.success
      ? run(deps, { ...ctx, data: parsed.data })
      : Promise.resolve(invalid(parsed.error));
  };
}

const ACTION_HANDLERS: Record<
  BillingAction,
  (deps: RouteDeps, ctx: ActionContext) => Promise<Response>
> = {
  status: withBody(emptyBody, async (deps, { organizationId }) => {
    const [sub, entitlement, invoices] = await Promise.all([
      deps.billing.getSubscription(organizationId),
      deps.billing.getEntitlement(organizationId),
      deps.billing.listInvoices(organizationId),
    ]);
    return json({
      subscription: publicSubscription(sub),
      entitlement: {
        active: entitlement.active,
        plan: entitlement.plan.key,
        reason: entitlement.reason,
      },
      invoices: invoices.map((i) => ({
        id: i.id,
        status: i.status,
        amountSubunit: i.amountSubunit,
        currency: i.currency,
        paidAt: i.paidAt,
        description: i.description,
      })),
    });
  }),

  checkout: withBody(planBody, async (deps, { organizationId, actor, data }) =>
    json(
      await deps.billing.startCheckout({
        organizationId,
        actor,
        planPriceId: data.planPriceId,
      })
    )
  ),

  "change-plan": withBody(
    planBody,
    async (deps, { organizationId, actor, data }) => {
      const [members] = await deps.db
        .select({ n: count() })
        .from(schema.member)
        .where(eq(schema.member.organizationId, organizationId));
      return json(
        await deps.billing.changePlan({
          organizationId,
          actor,
          planPriceId: data.planPriceId,
          memberCount: members?.n ?? 0,
        })
      );
    }
  ),

  cancel: withBody(emptyBody, async (deps, { organizationId, actor }) =>
    json(await deps.billing.cancel({ organizationId, actor }))
  ),

  resume: withBody(emptyBody, async (deps, { organizationId, actor }) => {
    await deps.billing.resume({ organizationId, actor });
    return json({ ok: true });
  }),

  "manage-card": withBody(emptyBody, async (deps, { organizationId }) =>
    json({ url: await deps.billing.getManageCardLink(organizationId) })
  ),

  "billing-details": withBody(
    billingDetailsBody,
    async (deps, { organizationId, actor, data }) => {
      const row = await deps.billing.updateBillingDetails({
        organizationId,
        actor,
        details: data,
      });
      return json({
        legalName: row?.legalName ?? null,
        address: row?.address ?? null,
        taxId: row?.taxId ?? null,
        email: row?.email ?? null,
      });
    }
  ),
};

/** Paystack events are a few KB; anything near this is not one of them. */
export const WEBHOOK_MAX_BYTES = 1024 * 1024;

/**
 * The client IP as the platform's own proxy recorded it. Only the right-most
 * entry of the header is trusted: that is the one the nearest proxy wrote;
 * everything to its left came from the caller and can be forged. On Vercel
 * the header is `x-vercel-forwarded-for`; elsewhere `x-forwarded-for`, or
 * whatever CLIENT_IP_HEADER names (e.g. `x-real-ip`, `cf-connecting-ip`).
 */
export function trustedClientIp(headers: Headers, header: string) {
  const value = headers.get(header);
  const ip = value?.split(",").at(-1)?.trim();
  return ip || null;
}

/** The body as text, or null once it passes `max` bytes. Content-Length is
 *  checked first, then the stream is counted (it may be chunked). */
export async function readBodyWithin(
  request: Request,
  max: number
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    return null;
  }
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** POST /api/webhooks/paystack. Persist first, process after responding. */
export async function handlePaystackWebhook(
  deps: Pick<RouteDeps, "db" | "billing">,
  input: {
    request: Request;
    secretKey: string;
    encryptionKey: string;
    enforceIpAllowlist: boolean;
    /** Header carrying the client IP, see `trustedClientIp`. */
    clientIpHeader?: string;
    schedule: (task: () => Promise<unknown>) => void;
  }
): Promise<Response> {
  const rawBody = await readBodyWithin(input.request, WEBHOOK_MAX_BYTES);
  if (rawBody === null) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  const result = await ingestWebhook({
    db: deps.db,
    rawBody,
    signature: input.request.headers.get("x-paystack-signature"),
    secretKey: input.secretKey,
    encryptionKey: input.encryptionKey,
    ip: trustedClientIp(
      input.request.headers,
      input.clientIpHeader ?? "x-forwarded-for"
    ),
    enforceIpAllowlist: input.enforceIpAllowlist,
  });
  if (result.status !== 200) {
    return json({ ok: false, error: result.reason }, result.status);
  }
  if (!result.duplicate) {
    const { eventId } = result;
    input.schedule(() => deps.billing.processEvent(eventId));
  }
  // `duplicate` tells a replay apart from a first delivery (the event was
  // stored before and is not processed again). Paystack ignores the body.
  return json({ ok: true, duplicate: result.duplicate });
}

/** Bearer-token check for cron routes, in constant time. */
export function isAuthorizedCron(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < header.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

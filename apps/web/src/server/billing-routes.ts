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
  let actor: { userId: string; email: string };
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
  actor: { userId: string; email: string };
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
};

/** POST /api/webhooks/paystack. Persist first, process after responding. */
export async function handlePaystackWebhook(
  deps: Pick<RouteDeps, "db" | "billing">,
  input: {
    request: Request;
    secretKey: string;
    enforceIpAllowlist: boolean;
    schedule: (task: () => Promise<unknown>) => void;
  }
): Promise<Response> {
  const rawBody = await input.request.text();
  const forwarded = input.request.headers.get("x-forwarded-for");
  const result = await ingestWebhook({
    db: deps.db,
    rawBody,
    signature: input.request.headers.get("x-paystack-signature"),
    secretKey: input.secretKey,
    ip: forwarded?.split(",")[0]?.trim() ?? null,
    enforceIpAllowlist: input.enforceIpAllowlist,
  });
  if (result.status !== 200) {
    return json({ ok: false, error: result.reason }, result.status);
  }
  if (!result.duplicate) {
    const { eventId } = result;
    input.schedule(() => deps.billing.processEvent(eventId));
  }
  return json({ ok: true });
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

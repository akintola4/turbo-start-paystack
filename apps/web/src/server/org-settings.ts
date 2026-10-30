import { isAuthError, rankOf, ROLE_RANK } from "@workspace/auth/permissions";
import { userRateLimit } from "@workspace/auth/rate-limit";
import type { AuthService } from "@workspace/auth/server";
import type { BillingService } from "@workspace/billing";
import { type Database, schema } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  deleteBlock,
  deleteBlockMessage,
  slugProblem,
} from "@/lib/org-settings";

export const ORG_SETTINGS_ACTIONS = [
  "general",
  "transfer",
  "leave",
  "delete",
] as const;
export type OrgSettingsAction = (typeof ORG_SETTINGS_ACTIONS)[number];

type Deps = {
  db: Database;
  authService: AuthService;
  billing: Pick<BillingService, "getSubscription">;
};

type Actor = { userId: string; email: string; role: string };

type Input = {
  headers: Headers;
  organizationId: string;
  action: string;
  body: unknown;
  contentType?: string | null;
};

// Strict bodies: nothing org-shaped (ids, roles, owners) is read from the
// client. The organization is the one in the URL.
const generalBody = z.strictObject({
  name: z.string().trim().min(1).max(64),
  slug: z.string().trim().toLowerCase(),
});
const transferBody = z.strictObject({
  memberId: z.string().min(1).max(64),
  confirm: z.string(),
});
const deleteBody = z.strictObject({ confirm: z.string() });
const emptyBody = z.strictObject({});

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Typed confirmation must match the name exactly, ignoring outer spaces. */
const confirms = (typed: string, name: string) => typed.trim() === name.trim();

/** A Better Auth APIError (or anything shaped like one) as a response. */
function fromAuthApi(error: unknown) {
  const e = error as {
    statusCode?: number;
    body?: { code?: string; message?: string };
    message?: string;
  };
  if (typeof e?.statusCode !== "number") {
    throw error;
  }
  return json(
    {
      error: e.body?.code?.toLowerCase() ?? "rejected",
      message: e.body?.message ?? e.message,
    },
    e.statusCode >= 500 ? 500 : e.statusCode
  );
}

async function loadOrg(db: Database, organizationId: string) {
  const [org] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  return org ?? null;
}

/**
 * Every organization-settings change goes through here: the session from
 * the headers, the role from the `member` row of the organization in the
 * URL, a strictly parsed body, then Better Auth's own endpoint with the
 * caller's headers (so its checks run too), then an audit row.
 */
export async function handleOrgSettings(
  deps: Deps,
  input: Input
): Promise<Response> {
  if (!(ORG_SETTINGS_ACTIONS as readonly string[]).includes(input.action)) {
    return json({ error: "not_found" }, 404);
  }
  if (!input.contentType?.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const action = input.action as OrgSettingsAction;
  let actor: Actor;
  try {
    actor = await deps.authService.requirePermission(
      input.headers,
      input.organizationId,
      PERMISSION[action]
    );
  } catch (error) {
    if (isAuthError(error)) {
      return json({ error: error.message }, error.status);
    }
    throw error;
  }
  const limited = await userRateLimit(deps.db, actor.userId, "orgMutation");
  if (limited) {
    return limited;
  }
  const org = await loadOrg(deps.db, input.organizationId);
  if (!org) {
    return json({ error: "not_found" }, 404);
  }
  try {
    return await HANDLERS[action](deps, { ...input, actor, org });
  } catch (error) {
    return fromAuthApi(error);
  }
}

const PERMISSION = {
  general: "organization:update",
  // Only owners hold organization:delete; transfer is theirs alone too.
  transfer: "organization:delete",
  // Every role can read its own access; leaving needs only membership.
  leave: "ac:read",
  delete: "organization:delete",
} as const satisfies Record<OrgSettingsAction, string>;

type Ctx = Input & {
  actor: Actor;
  org: NonNullable<Awaited<ReturnType<typeof loadOrg>>>;
};

const HANDLERS: Record<
  OrgSettingsAction,
  (deps: Deps, ctx: Ctx) => Promise<Response>
> = {
  async general(deps, { headers, body, actor, org }) {
    const parsed = generalBody.safeParse(body);
    if (!parsed.success) {
      return json({ error: "invalid_body" }, 400);
    }
    const { name, slug } = parsed.data;
    const problem = slugProblem(slug);
    if (problem) {
      return json({ error: "invalid_slug", message: problem }, 400);
    }
    if (name === org.name && slug === org.slug) {
      return json({ slug });
    }
    await deps.authService.auth.api.updateOrganization({
      headers,
      body: { organizationId: org.id, data: { name, slug } },
    });
    await deps.authService.audit({
      organizationId: org.id,
      actorUserId: actor.userId,
      action: "organization.update",
      data: {
        from: { name: org.name, slug: org.slug },
        to: { name, slug },
      },
    });
    return json({ slug });
  },

  async transfer(deps, { headers, body, actor, org }) {
    const parsed = transferBody.safeParse(body);
    if (!parsed.success) {
      return json({ error: "invalid_body" }, 400);
    }
    if (rankOf(actor.role) < ROLE_RANK.owner) {
      return json({ error: "Only an owner can transfer ownership" }, 403);
    }
    if (!confirms(parsed.data.confirm, org.name)) {
      return json(
        { error: "confirm_mismatch", message: "Type the name exactly." },
        400
      );
    }
    const [target] = await deps.db
      .select()
      .from(schema.member)
      .where(
        and(
          eq(schema.member.id, parsed.data.memberId),
          eq(schema.member.organizationId, org.id)
        )
      )
      .limit(1);
    if (!target) {
      return json({ error: "not_found" }, 404);
    }
    if (target.userId === actor.userId) {
      return json(
        { error: "same_member", message: "You already own it." },
        400
      );
    }
    const me = await deps.authService.findMember(org.id, actor.userId);
    if (!me) {
      return json({ error: "not_found" }, 404);
    }
    const { api } = deps.authService.auth;
    // Promote first, so the organization is never without an owner.
    await api.updateMemberRole({
      headers,
      body: { organizationId: org.id, memberId: target.id, role: "owner" },
    });
    await api.updateMemberRole({
      headers,
      body: { organizationId: org.id, memberId: me.id, role: "admin" },
    });
    await deps.authService.audit({
      organizationId: org.id,
      actorUserId: actor.userId,
      action: "organization.transfer_ownership",
      target: target.userId,
      data: { previousRole: target.role },
    });
    return json({ ok: true });
  },

  async leave(deps, { headers, body, actor, org }) {
    if (!emptyBody.safeParse(body).success) {
      return json({ error: "invalid_body" }, 400);
    }
    const sole = await deps.authService.soleOwnedOrganizations(actor.userId);
    if (sole.some((o) => o.id === org.id)) {
      return json(
        {
          error: "sole_owner",
          message:
            "You're the only owner. Transfer ownership first, or delete the organization.",
        },
        409
      );
    }
    // Written first: the member row (and so the actor's link to the org)
    // is gone once Better Auth is done.
    await deps.authService.audit({
      organizationId: org.id,
      actorUserId: actor.userId,
      action: "member.leave",
      target: actor.userId,
      data: { role: actor.role },
    });
    await deps.authService.auth.api.leaveOrganization({
      headers,
      body: { organizationId: org.id },
    });
    return json({ ok: true });
  },

  async delete(deps, { headers, body, actor, org }) {
    const parsed = deleteBody.safeParse(body);
    if (!parsed.success) {
      return json({ error: "invalid_body" }, 400);
    }
    if (!confirms(parsed.data.confirm, org.name)) {
      return json(
        { error: "confirm_mismatch", message: "Type the name exactly." },
        400
      );
    }
    // Checked here for a clear answer; Better Auth's delete hook checks
    // again (server/context.ts), so its own endpoint can't skip it.
    const block = deleteBlock(await deps.billing.getSubscription(org.id));
    if (block) {
      return json(
        {
          error: "subscription_active",
          message: deleteBlockMessage(block),
          accessEndsAt: block.accessEndsAt,
        },
        409
      );
    }
    await deps.authService.auth.api.deleteOrganization({
      headers,
      body: { organizationId: org.id },
    });
    // Org-less: the org's own audit rows are deleted with it.
    await deps.authService.audit({
      organizationId: null,
      actorUserId: actor.userId,
      action: "organization.delete",
      target: org.id,
      data: { name: org.name, slug: org.slug },
    });
    return json({ ok: true });
  },
};

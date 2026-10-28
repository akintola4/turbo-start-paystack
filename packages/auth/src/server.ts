import { type Database, schema } from "@workspace/db";
import type { AuthMailer } from "@workspace/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { organization } from "better-auth/plugins/organization";
import { and, count, eq, gt } from "drizzle-orm";

import { AuthError } from "./errors";
import {
  ac,
  type Permission,
  type Role,
  rankOf,
  roleHasPermission,
  roles,
} from "./roles";

export type CreateAuthOptions = {
  db: Database;
  secret: string;
  baseURL: string;
  /** Renders and sends the verification, reset and invitation emails
   *  (`createMailer` from @workspace/email). */
  mailer: AuthMailer;
  /** Max members (including pending invitations) for an organization. Wire it
   *  to the org's plan limits. Defaults to 100. */
  memberLimit?: (organizationId: string) => Promise<number>;
  /** Runs before an organization is deleted, e.g. to cancel its billing. */
  beforeDeleteOrganization?: (organizationId: string) => Promise<void>;
  trustedOrigins?: string[];
};

const SEVEN_DAYS = 7;
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * SEVEN_DAYS;

export const INVITATION_EXPIRES_IN_SECONDS = SEVEN_DAYS_SECONDS;

function newId() {
  return crypto.randomUUID();
}

export function createAuth(options: CreateAuthOptions) {
  const { db, mailer } = options;
  const memberLimit = options.memberLimit ?? (async () => 100);

  async function findMember(organizationId: string, userId: string) {
    const [row] = await db
      .select()
      .from(schema.member)
      .where(
        and(
          eq(schema.member.organizationId, organizationId),
          eq(schema.member.userId, userId)
        )
      )
      .limit(1);
    return row ?? null;
  }

  async function audit(entry: {
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    target?: string;
    data?: Record<string, unknown>;
  }) {
    await db.insert(schema.auditLog).values({
      id: newId(),
      organizationId: entry.organizationId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      data: entry.data ?? null,
    });
  }

  type HookCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

  // Only people who can invite may see pending invitations, because an
  // invitation id is the acceptance token.
  async function guardListInvitations(ctx: HookCtx) {
    const session = await getSessionFromCtx(ctx);
    const orgId =
      (ctx.query?.organizationId as string | undefined) ??
      session?.session.activeOrganizationId;
    if (!(session && orgId)) {
      return;
    }
    const me = await findMember(orgId, session.user.id);
    if (me && !roleHasPermission(me.role, "invitation:create")) {
      throw new APIError("FORBIDDEN", {
        message: "You are not allowed to view invitations",
      });
    }
  }

  // Nobody may grant a role ranked above their own, or change the role of
  // someone ranked above them.
  async function guardRoleUpdate(ctx: HookCtx) {
    const session = await getSessionFromCtx(ctx);
    const body = ctx.body as {
      memberId?: string;
      role?: string | string[];
      organizationId?: string;
    };
    const orgId = body.organizationId ?? session?.session.activeOrganizationId;
    if (!(session && orgId && body.memberId)) {
      return;
    }
    const me = await findMember(orgId, session.user.id);
    const [target] = await db
      .select()
      .from(schema.member)
      .where(
        and(
          eq(schema.member.id, body.memberId),
          eq(schema.member.organizationId, orgId)
        )
      )
      .limit(1);
    if (!(me && target)) {
      return;
    }
    const nextRole = Array.isArray(body.role)
      ? body.role.join(",")
      : (body.role ?? "");
    const myRank = rankOf(me.role);
    if (rankOf(nextRole) > myRank || rankOf(target.role) > myRank) {
      throw new APIError("FORBIDDEN", {
        message: "You cannot assign a role above your own",
      });
    }
  }

  const auth = betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => {
        await mailer.resetPassword({ to: user.email, name: user.name, url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.verifyEmail({ to: user.email, name: user.name, url });
      },
    },
    rateLimit: { enabled: true, window: 60, max: 100 },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/organization/list-invitations") {
          await guardListInvitations(ctx);
        }
        if (ctx.path === "/organization/update-member-role") {
          await guardRoleUpdate(ctx);
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        // The full-organization payload embeds invitations. Strip them for
        // members who cannot invite.
        if (ctx.path === "/organization/get-full-organization") {
          const returned = ctx.context.returned as
            | { id?: string; invitations?: unknown[] }
            | undefined;
          const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
          if (returned?.id && session && Array.isArray(returned.invitations)) {
            const me = await findMember(returned.id, session.user.id);
            if (!(me && roleHasPermission(me.role, "invitation:create"))) {
              return ctx.json({ ...returned, invitations: [] });
            }
          }
        }
      }),
    },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: "owner",
        invitationExpiresIn: SEVEN_DAYS_SECONDS,
        cancelPendingInvitationsOnReInvite: true,
        requireEmailVerificationOnInvitation: true,
        membershipLimit: async (_user, org) => memberLimit(org.id),
        sendInvitationEmail: async ({
          email,
          id,
          role,
          organization: org,
          inviter,
        }) => {
          // The link is built by the mailer from the app URL and the id;
          // names are rendered as escaped text.
          await mailer.organizationInvitation({
            to: email,
            invitationId: id,
            inviterName: inviter.user.name || inviter.user.email,
            inviterEmail: inviter.user.email,
            organizationName: org.name,
            role,
            expiresInDays: SEVEN_DAYS,
          });
        },
        organizationHooks: {
          beforeCreateInvitation: async ({
            invitation,
            inviter,
            organization: org,
          }) => {
            const me = await findMember(org.id, inviter.id);
            if (!me || rankOf(invitation.role) > rankOf(me.role)) {
              throw new APIError("FORBIDDEN", {
                message: "You cannot invite someone to a role above your own",
              });
            }
            const [members] = await db
              .select({ n: count() })
              .from(schema.member)
              .where(eq(schema.member.organizationId, org.id));
            const [pending] = await db
              .select({ n: count() })
              .from(schema.invitation)
              .where(
                and(
                  eq(schema.invitation.organizationId, org.id),
                  eq(schema.invitation.status, "pending"),
                  gt(schema.invitation.expiresAt, new Date())
                )
              );
            const limit = await memberLimit(org.id);
            if ((members?.n ?? 0) + (pending?.n ?? 0) >= limit) {
              throw new APIError("FORBIDDEN", {
                message: `Your plan allows ${limit} members. Upgrade to invite more.`,
              });
            }
          },
          afterCreateInvitation: async ({ invitation, inviter }) => {
            await audit({
              organizationId: invitation.organizationId,
              actorUserId: inviter.id,
              action: "invitation.create",
              target: invitation.email,
              data: { role: invitation.role },
            });
          },
          afterAcceptInvitation: async ({ invitation, user }) => {
            await audit({
              organizationId: invitation.organizationId,
              actorUserId: user.id,
              action: "invitation.accept",
              target: user.id,
              data: { role: invitation.role },
            });
          },
          afterUpdateMemberRole: async ({ member, previousRole }) => {
            await audit({
              organizationId: member.organizationId,
              action: "member.update_role",
              target: member.userId,
              data: { from: previousRole, to: member.role },
            });
          },
          afterRemoveMember: async ({ member }) => {
            await audit({
              organizationId: member.organizationId,
              action: "member.remove",
              target: member.userId,
            });
          },
          beforeDeleteOrganization: async ({ organization: org }) => {
            await options.beforeDeleteOrganization?.(org.id);
          },
        },
      }),
    ],
  });

  /**
   * The one server-side gate for org-scoped actions. Resolves the session
   * from request headers and the role from the `member` row of the given
   * organization (never from the request body or a global user role).
   */
  async function requirePermission(
    headers: Headers,
    organizationId: string,
    permission: Permission
  ): Promise<{ userId: string; email: string; role: Role | string }> {
    const session = await auth.api.getSession({ headers });
    if (!session) {
      throw new AuthError(401, "Not signed in");
    }
    const me = await findMember(organizationId, session.user.id);
    if (!me) {
      throw new AuthError(403, "Not a member of this organization");
    }
    if (!roleHasPermission(me.role, permission)) {
      throw new AuthError(403, `Missing permission ${permission}`);
    }
    return {
      userId: session.user.id,
      email: session.user.email,
      role: me.role,
    };
  }

  /** Session + membership for an org looked up by slug. Null when the user
   *  is not a member (callers should 404, not 403, to avoid leaking slugs). */
  async function getMembershipBySlug(headers: Headers, slug: string) {
    const session = await auth.api.getSession({ headers });
    if (!session) {
      return null;
    }
    const [row] = await db
      .select({ org: schema.organization, member: schema.member })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id)
      )
      .where(
        and(
          eq(schema.organization.slug, slug),
          eq(schema.member.userId, session.user.id)
        )
      )
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      session,
      organization: row.org,
      member: row.member,
      can: (permission: Permission) =>
        roleHasPermission(row.member.role, permission),
    };
  }

  return { auth, requirePermission, getMembershipBySlug, audit };
}

export type AuthService = ReturnType<typeof createAuth>;
export type Auth = AuthService["auth"];

export { roleHasPermission } from "./roles";

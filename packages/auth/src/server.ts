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
  /** Runs before an organization is deleted, e.g. to cancel its billing.
   *  Return `{ blocked }` to refuse the delete with that message. */
  beforeDeleteOrganization?: (
    organizationId: string
  ) => Promise<{ blocked: string } | undefined>;
  trustedOrigins?: string[];
};

/** Slugs that would be shadowed by app routes (`/app/account`). */
export const RESERVED_SLUGS = ["account"] as const;

/** How long a change-email link works: Better Auth's verification default. */
export const CHANGE_EMAIL_EXPIRES_IN_SECONDS = 60 * 60;

const PENDING_EMAIL = "pending-email:";

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

  /** An audit row. `organizationId` is null for something that outlives
   *  the organization's own rows, like its deletion. */
  async function audit(entry: {
    organizationId: string | null;
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

  /** Organizations the user owns where nobody else is an owner. */
  async function soleOwnedOrganizations(userId: string) {
    const owned = await db
      .select({ org: schema.organization, role: schema.member.role })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id)
      )
      .where(eq(schema.member.userId, userId));
    const sole: { id: string; name: string; slug: string }[] = [];
    for (const { org, role } of owned) {
      if (!isOwner(role)) {
        continue;
      }
      const others = await db
        .select({ role: schema.member.role, userId: schema.member.userId })
        .from(schema.member)
        .where(eq(schema.member.organizationId, org.id));
      if (!others.some((m) => m.userId !== userId && isOwner(m.role))) {
        sole.push({ id: org.id, name: org.name, slug: org.slug });
      }
    }
    return sole;
  }

  /** The address a change-email link was last sent to, while it works. */
  async function pendingEmail(userId: string, currentEmail: string) {
    const [row] = await db
      .select()
      .from(schema.verification)
      .where(eq(schema.verification.identifier, `${PENDING_EMAIL}${userId}`))
      .limit(1);
    if (!row) {
      return null;
    }
    if (row.expiresAt <= new Date() || row.value === currentEmail) {
      await clearPendingEmail(userId);
      return null;
    }
    return { email: row.value, expiresAt: row.expiresAt };
  }

  async function clearPendingEmail(userId: string) {
    await db
      .delete(schema.verification)
      .where(eq(schema.verification.identifier, `${PENDING_EMAIL}${userId}`));
  }

  async function recordPendingEmail(userId: string, email: string) {
    await clearPendingEmail(userId);
    await db.insert(schema.verification).values({
      id: newId(),
      identifier: `${PENDING_EMAIL}${userId}`,
      value: email.toLowerCase(),
      expiresAt: new Date(Date.now() + CHANGE_EMAIL_EXPIRES_IN_SECONDS * 1000),
    });
  }

  type HookCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

  // Better Auth keeps no record of a requested address until the link is
  // used; note it so the account page can show it as pending.
  async function notePendingEmail(ctx: HookCtx) {
    const returned = ctx.context.returned as { status?: boolean } | undefined;
    const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
    const newEmail = (ctx.body as { newEmail?: string } | undefined)?.newEmail;
    if (returned?.status === true && session && newEmail) {
      await recordPendingEmail(session.user.id, newEmail);
    }
  }

  // The full-organization payload embeds invitations. Strip them for
  // members who cannot invite.
  async function stripInvitations(ctx: HookCtx) {
    const returned = ctx.context.returned as
      | { id?: string; invitations?: unknown[] }
      | undefined;
    const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
    if (!(returned?.id && session && Array.isArray(returned.invitations))) {
      return;
    }
    const me = await findMember(returned.id, session.user.id);
    if (!(me && roleHasPermission(me.role, "invitation:create"))) {
      return ctx.json({ ...returned, invitations: [] });
    }
  }

  // An org slug that an app route would shadow can't be taken.
  function guardReservedSlug(ctx: HookCtx) {
    const body = ctx.body as
      | { slug?: string; data?: { slug?: string } }
      | undefined;
    const slug = body?.data?.slug ?? body?.slug;
    if (
      typeof slug === "string" &&
      (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase())
    ) {
      throw new APIError("BAD_REQUEST", {
        code: "ORGANIZATION_SLUG_ALREADY_TAKEN",
        message: "That address is reserved. Pick another.",
      });
    }
  }

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
      // No session until the address is confirmed; sign-up and sign-in
      // (re)send the link.
      requireEmailVerification: true,
      // A reset signs out every other device, including whoever had the
      // old password.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.resetPassword({ to: user.email, name: user.name, url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // An unverified sign-in gets a fresh link instead of a session.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: CHANGE_EMAIL_EXPIRES_IN_SECONDS,
      // A verified user here is changing address: Better Auth passes the
      // new one as `user.email`, and the link goes only there.
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.verifyEmail({
          to: user.email,
          name: user.name,
          url,
          purpose: user.emailVerified ? "change-email" : "sign-up",
        });
      },
    },
    user: {
      changeEmail: { enabled: true },
      deleteUser: {
        enabled: true,
        // Nobody can leave an organization without an owner by deleting
        // their account; they transfer ownership or delete it first.
        beforeDelete: async (user) => {
          const sole = await soleOwnedOrganizations(user.id);
          if (sole.length > 0) {
            throw new APIError("BAD_REQUEST", {
              code: "SOLE_OWNER",
              message: `You're the only owner of ${sole
                .map((o) => o.name)
                .join(
                  ", "
                )}. Transfer ownership or delete ${sole.length === 1 ? "it" : "them"} first.`,
            });
          }
          const memberships = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, user.id));
          for (const m of memberships) {
            await audit({
              organizationId: m.organizationId,
              actorUserId: user.id,
              action: "member.account_deleted",
              target: user.id,
            });
          }
          await clearPendingEmail(user.id);
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      // Each request sends an email: three a minute per address is plenty
      // for a person and too few to spam an inbox with.
      customRules: { "/request-password-reset": { window: 60, max: 3 } },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/organization/list-invitations") {
          await guardListInvitations(ctx);
        }
        if (ctx.path === "/organization/update-member-role") {
          await guardRoleUpdate(ctx);
        }
        if (
          ctx.path === "/organization/create" ||
          ctx.path === "/organization/update" ||
          ctx.path === "/organization/check-slug"
        ) {
          guardReservedSlug(ctx);
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/change-email") {
          await notePendingEmail(ctx);
        }
        if (ctx.path === "/organization/get-full-organization") {
          return stripInvitations(ctx);
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
            const result = await options.beforeDeleteOrganization?.(org.id);
            if (result?.blocked) {
              throw new APIError("BAD_REQUEST", {
                code: "ORGANIZATION_DELETE_BLOCKED",
                message: result.blocked,
              });
            }
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
  ): Promise<{
    userId: string;
    email: string;
    emailVerified: boolean;
    role: Role | string;
  }> {
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
      emailVerified: session.user.emailVerified,
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

  return {
    auth,
    requirePermission,
    getMembershipBySlug,
    findMember,
    audit,
    soleOwnedOrganizations,
    pendingEmail,
  };
}

function isOwner(role: string) {
  return role
    .split(",")
    .map((r) => r.trim())
    .includes("owner");
}

export type AuthService = ReturnType<typeof createAuth>;
export type Auth = AuthService["auth"];

export { roleHasPermission } from "./roles";

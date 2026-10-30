import { randomUUID } from "node:crypto";
import { createAuth } from "@workspace/auth/server";
import { type Database, schema } from "@workspace/db";
import type { AuthMailer } from "@workspace/email";
import { and, eq } from "drizzle-orm";

/**
 * Demo data so `pnpm setup` ends with someone to sign in as: an owner, a
 * billing manager and a member of one organization, all with verified
 * email. Users go through Better Auth (so passwords are hashed the way
 * sign-in expects); nothing billing-related is written. Safe to re-run.
 */

export const DEMO_PASSWORD = "kola-demo-2026";

export const DEMO_ORG = { name: "Kola Logistics", slug: "kola-logistics" };

export const DEMO_USERS = [
  { name: "Ada Okafor", email: "ada@kolalogistics.test", role: "owner" },
  { name: "Tunde Bakare", email: "tunde@kolalogistics.test", role: "billing" },
  { name: "Chioma Eze", email: "chioma@kolalogistics.test", role: "member" },
] as const;

const SILENT_MAILER: AuthMailer = {
  verifyEmail: async () => undefined,
  changeEmailApproval: async () => undefined,
  resetPassword: async () => undefined,
  organizationInvitation: async () => undefined,
};

export async function seedDemo(input: {
  db: Database;
  secret: string;
  baseURL: string;
}): Promise<{ createdUsers: number; createdOrg: boolean }> {
  const { db } = input;
  const { auth } = createAuth({
    db,
    secret: input.secret,
    baseURL: input.baseURL,
    // No email at seed time (nothing is rendered either): the users are
    // marked verified below.
    mailer: SILENT_MAILER,
  });

  let createdUsers = 0;
  const ids = new Map<string, string>();
  for (const user of DEMO_USERS) {
    let [row] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, user.email));
    if (!row) {
      await auth.api.signUpEmail({
        body: { email: user.email, password: DEMO_PASSWORD, name: user.name },
      });
      [row] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, user.email));
      createdUsers += 1;
    }
    if (!row) {
      throw new Error(`could not create ${user.email}`);
    }
    await db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.id, row.id));
    ids.set(user.email, row.id);
  }

  let [org] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, DEMO_ORG.slug));
  const createdOrg = !org;
  if (!org) {
    org = { id: randomUUID() };
    await db.insert(schema.organization).values({ id: org.id, ...DEMO_ORG });
  }
  for (const user of DEMO_USERS) {
    const userId = ids.get(user.email) as string;
    const [member] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.organizationId, org.id),
          eq(schema.member.userId, userId)
        )
      );
    if (!member) {
      await db.insert(schema.member).values({
        id: randomUUID(),
        organizationId: org.id,
        userId,
        role: user.role,
      });
    }
  }
  return { createdUsers, createdOrg };
}

import { type Database, schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { createMailer, type EmailMessage } from "@workspace/email";
import { eq } from "drizzle-orm";

import { type CreateAuthOptions, createAuth } from "../src/server";

export async function setupAuth(
  overrides: Pick<CreateAuthOptions, "beforeDeleteOrganization"> = {}
) {
  const limits = { members: 100 };
  const { db, close } = await createTestDb();
  const outbox: EmailMessage[] = [];
  const service = createAuth({
    db,
    secret: "test-secret-test-secret-test-secret-123",
    baseURL: "http://localhost:3000",
    mailer: createMailer({
      appUrl: "http://localhost:3000",
      send: async (m) => {
        outbox.push(m);
      },
    }),
    memberLimit: async () => limits.members,
    ...overrides,
  });
  return { db, close, outbox, limits, ...service };
}

type Ctx = Awaited<ReturnType<typeof setupAuth>>;

/** Signs a user up, marks their email verified, and returns request headers
 *  carrying their session cookie. */
export async function signUp(ctx: Ctx, email: string) {
  await ctx.auth.api.signUpEmail({
    body: { email, password: "correct-horse-battery", name: email },
  });
  await verify(ctx.db, email);
  const res = await ctx.auth.api.signInEmail({
    body: { email, password: "correct-horse-battery" },
    asResponse: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

export async function verify(db: Database, email: string) {
  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.email, email));
}

export async function createOrg(ctx: Ctx, headers: Headers, slug: string) {
  const org = await ctx.auth.api.createOrganization({
    headers,
    body: { name: slug, slug },
  });
  if (!org) {
    throw new Error("org not created");
  }
  return org;
}

/** Invites `email` as `role` and has them accept, returning their headers. */
export async function addMember(
  ctx: Ctx,
  ownerHeaders: Headers,
  organizationId: string,
  email: string,
  role: "admin" | "billing" | "member" | "viewer"
) {
  const inv = await ctx.auth.api.createInvitation({
    headers: ownerHeaders,
    body: { email, role, organizationId },
  });
  const headers = await signUp(ctx, email);
  await ctx.auth.api.acceptInvitation({
    headers,
    body: { invitationId: inv.id },
  });
  return headers;
}

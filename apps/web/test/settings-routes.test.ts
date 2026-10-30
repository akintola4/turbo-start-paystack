import { createAuth } from "@workspace/auth/server";
import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { createMailer } from "@workspace/email";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deleteBlock,
  deleteBlockMessage,
  type SubscriptionForDelete,
} from "../src/lib/org-settings";
import { handleRevokeSession } from "../src/server/account";
import { handleOrgSettings } from "../src/server/org-settings";

const PASSWORD = "correct-horse-battery";
/** The subscription each org "has", standing in for the billing service. */
const subs = new Map<string, SubscriptionForDelete>();

let ctx: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const { db, close } = await createTestDb();
  const billing = {
    getSubscription: async (organizationId: string) =>
      (subs.get(organizationId) ?? null) as never,
  };
  const authService = createAuth({
    db,
    secret: "settings-test-secret-settings-test-secret",
    baseURL: "http://localhost:3000",
    mailer: createMailer({
      appUrl: "http://localhost:3000",
      send: async () => undefined,
    }),
    // The same rule server/context.ts wires in.
    beforeDeleteOrganization: async (organizationId) => {
      const block = deleteBlock(subs.get(organizationId) ?? null);
      return block ? { blocked: deleteBlockMessage(block) } : undefined;
    },
  });
  return { db, close, authService, billing };
}

function cookieOf(res: Response) {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function signIn(email: string) {
  const res = await ctx.authService.auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  return new Headers({ cookie: cookieOf(res) });
}

async function signUp(email: string) {
  await ctx.authService.auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: email.split("@")[0] ?? email },
  });
  // Sign-in needs a verified email.
  await ctx.db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.email, email));
  return signIn(email);
}

async function userId(email: string) {
  const [u] = await ctx.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email));
  return u?.id ?? "";
}

async function addMember(orgId: string, email: string, role: string) {
  const headers = await signUp(email);
  await ctx.db.insert(schema.member).values({
    id: `m_${email}`,
    organizationId: orgId,
    userId: await userId(email),
    role,
  });
  return headers;
}

async function createOrg(headers: Headers, name: string, slug: string) {
  const org = await ctx.authService.auth.api.createOrganization({
    headers,
    body: { name, slug },
  });
  return org?.id ?? "";
}

const call = (
  headers: Headers,
  organizationId: string,
  action: string,
  body: unknown = {}
) =>
  handleOrgSettings(ctx, {
    headers,
    organizationId,
    action,
    body,
    contentType: "application/json",
  });

async function orgRow(id: string) {
  const [org] = await ctx.db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, id));
  return org;
}

async function roleOf(orgId: string, email: string) {
  const [m] = await ctx.db
    .select()
    .from(schema.member)
    .where(
      and(
        eq(schema.member.organizationId, orgId),
        eq(schema.member.userId, await userId(email))
      )
    );
  return m?.role ?? null;
}

let owner: Headers;
let admin: Headers;
let billingManager: Headers;
let member: Headers;
let orgId: string;

beforeAll(async () => {
  ctx = await setup();
  owner = await signUp("ada@kola.test");
  orgId = await createOrg(owner, "Kola Logistics", "kola-logistics");
  admin = await addMember(orgId, "femi@kola.test", "admin");
  billingManager = await addMember(orgId, "tunde@kola.test", "billing");
  member = await addMember(orgId, "chioma@kola.test", "member");
  await createOrg(await signUp("owner@globex.test"), "Globex", "globex");
});
afterAll(async () => ctx.close());

describe("organization settings: general", () => {
  it("a member and a billing manager can't rename it", async () => {
    for (const headers of [member, billingManager]) {
      const res = await call(headers, orgId, "general", {
        name: "Hijacked",
        slug: "kola-logistics",
      });
      expect(res.status).toBe(403);
    }
    expect((await orgRow(orgId))?.name).toBe("Kola Logistics");
  });

  it("someone outside the org can't touch it", async () => {
    const outsider = await signUp("eve@evil.test");
    const res = await call(outsider, orgId, "general", {
      name: "Evil",
      slug: "evil",
    });
    expect(res.status).toBe(403);
  });

  it("rejects bodies that carry anything but name and slug", async () => {
    const res = await call(owner, orgId, "general", {
      name: "Kola",
      slug: "kola-logistics",
      organizationId: "someone-else",
    });
    expect(res.status).toBe(400);
  });

  it("an admin can rename it, and the change is audited", async () => {
    const res = await call(admin, orgId, "general", {
      name: "Kola Logistics NG",
      slug: "kola-logistics",
    });
    expect(res.status).toBe(200);
    expect((await orgRow(orgId))?.name).toBe("Kola Logistics NG");
    const audit = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.organizationId, orgId),
          eq(schema.auditLog.action, "organization.update")
        )
      );
    expect(audit[0]?.data).toMatchObject({
      from: { name: "Kola Logistics" },
      to: { name: "Kola Logistics NG" },
    });
  });

  it("a slug that's taken, malformed or reserved is refused", async () => {
    const taken = await call(owner, orgId, "general", {
      name: "Kola Logistics NG",
      slug: "globex",
    });
    expect(taken.status).toBe(400);
    expect(await taken.json()).toMatchObject({
      error: "organization_slug_already_taken",
    });
    for (const slug of ["kola-", "ab", "account"]) {
      const res = await call(owner, orgId, "general", {
        name: "Kola Logistics NG",
        slug,
      });
      expect(res.status).toBe(400);
    }
    expect((await orgRow(orgId))?.slug).toBe("kola-logistics");
  });

  it("the owner can change the slug and gets the new one back", async () => {
    const res = await call(owner, orgId, "general", {
      name: "Kola Logistics NG",
      slug: "Kola-NG",
    });
    expect(await res.json()).toEqual({ slug: "kola-ng" });
    expect((await orgRow(orgId))?.slug).toBe("kola-ng");
  });
});

describe("organization settings: transfer ownership", () => {
  it("a billing manager or an admin can't transfer it", async () => {
    for (const headers of [billingManager, admin]) {
      const res = await call(headers, orgId, "transfer", {
        memberId: "m_tunde@kola.test",
        confirm: "Kola Logistics NG",
      });
      expect(res.status).toBe(403);
    }
    expect(await roleOf(orgId, "ada@kola.test")).toBe("owner");
  });

  it("needs the name typed exactly", async () => {
    const res = await call(owner, orgId, "transfer", {
      memberId: "m_femi@kola.test",
      confirm: "kola logistics",
    });
    expect(res.status).toBe(400);
    expect(await roleOf(orgId, "femi@kola.test")).toBe("admin");
  });

  it("can't target a member of another organization", async () => {
    const res = await call(owner, orgId, "transfer", {
      memberId: "m_not-here",
      confirm: "Kola Logistics NG",
    });
    expect(res.status).toBe(404);
  });

  it("makes the member the owner and the old owner an admin", async () => {
    const res = await call(owner, orgId, "transfer", {
      memberId: "m_femi@kola.test",
      confirm: " Kola Logistics NG ",
    });
    expect(res.status).toBe(200);
    expect(await roleOf(orgId, "femi@kola.test")).toBe("owner");
    expect(await roleOf(orgId, "ada@kola.test")).toBe("admin");
    // And back, for the tests below: Femi is the owner now.
    const [ada] = await ctx.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, await userId("ada@kola.test")));
    const restored = await call(admin, orgId, "transfer", {
      memberId: ada?.id ?? "",
      confirm: "Kola Logistics NG",
    });
    expect(restored.status).toBe(200);
    expect(await roleOf(orgId, "ada@kola.test")).toBe("owner");
  });
});

describe("organization settings: delete", () => {
  it("a member or an admin can't delete it", async () => {
    for (const headers of [member, admin]) {
      const res = await call(headers, orgId, "delete", {
        confirm: "Kola Logistics NG",
      });
      expect(res.status).toBe(403);
    }
  });

  it("the owner can't delete it while a paid plan renews, and is told when access ends", async () => {
    subs.set(orgId, {
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2028-02-12T21:03:00.000Z",
      graceUntil: null,
    });
    const res = await call(owner, orgId, "delete", {
      confirm: "Kola Logistics NG",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Cancel it in Billing first/);
    expect(body.message).toMatch(/12 Feb 2028/);
    expect(await orgRow(orgId)).toBeDefined();
  });

  it("Better Auth's own delete endpoint refuses it too", async () => {
    await expect(
      ctx.authService.auth.api.deleteOrganization({
        headers: owner,
        body: { organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await orgRow(orgId)).toBeDefined();
  });

  it("a past-due plan blocks it as well", async () => {
    subs.set(orgId, {
      status: "past_due",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2028-02-12T21:03:00.000Z",
      graceUntil: "2028-01-19T21:03:00.000Z",
    });
    const res = await call(owner, orgId, "delete", {
      confirm: "Kola Logistics NG",
    });
    expect(res.status).toBe(409);
  });
});

describe("organization settings: leave", () => {
  it("the only owner can't leave", async () => {
    const solo = await signUp("solo@solo.test");
    const soloOrg = await createOrg(solo, "Solo", "solo-co");
    const res = await call(solo, soloOrg, "leave");
    expect(res.status).toBe(409);
  });

  it("a member can leave, and it's audited on the org", async () => {
    const res = await call(member, orgId, "leave");
    expect(res.status).toBe(200);
    expect(await roleOf(orgId, "chioma@kola.test")).toBeNull();
    const audit = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.organizationId, orgId),
          eq(schema.auditLog.action, "member.leave")
        )
      );
    expect(audit).toHaveLength(1);
  });
});

describe("organization settings: delete once the plan ends", () => {
  it("goes through with the name typed, and leaves an org-less audit row", async () => {
    subs.set(orgId, {
      status: "non_renewing",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2028-02-12T21:03:00.000Z",
      graceUntil: null,
    });
    const wrong = await call(owner, orgId, "delete", { confirm: "Kola" });
    expect(wrong.status).toBe(400);
    const res = await call(owner, orgId, "delete", {
      confirm: "Kola Logistics NG",
    });
    expect(res.status).toBe(200);
    expect(await orgRow(orgId)).toBeUndefined();
    const audit = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          isNull(schema.auditLog.organizationId),
          eq(schema.auditLog.action, "organization.delete")
        )
      );
    expect(audit[0]).toMatchObject({
      target: orgId,
      data: { name: "Kola Logistics NG", slug: "kola-ng" },
    });
  });
});

describe("account: revoking sessions", () => {
  const revoke = (headers: Headers, sessionId: string) =>
    handleRevokeSession(ctx, {
      headers,
      body: { sessionId },
      contentType: "application/json",
    });

  async function sessionsOf(email: string) {
    return ctx.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, await userId(email)));
  }

  it("signs out another of your own sessions", async () => {
    const laptop = await signUp("kemi@kola.test");
    const phone = await signIn("kemi@kola.test");
    const onPhone = await ctx.authService.auth.api.getSession({
      headers: phone,
    });
    const res = await revoke(laptop, onPhone?.session.id ?? "");
    expect(res.status).toBe(200);
    expect(
      await ctx.authService.auth.api.getSession({ headers: phone })
    ).toBeNull();
    expect(
      await ctx.authService.auth.api.getSession({ headers: laptop })
    ).not.toBeNull();
  });

  it("can't revoke someone else's session: it's a 404 and theirs stays", async () => {
    const victim = await signUp("victim@kola.test");
    const [theirs] = await sessionsOf("victim@kola.test");
    const attacker = await signUp("mallory@evil.test");
    const res = await revoke(attacker, theirs?.id ?? "");
    expect(res.status).toBe(404);
    expect(
      await ctx.authService.auth.api.getSession({ headers: victim })
    ).not.toBeNull();
  });

  it("won't revoke the session making the request, or work signed out", async () => {
    const me = await signUp("self@kola.test");
    const current = await ctx.authService.auth.api.getSession({ headers: me });
    expect((await revoke(me, current?.session.id ?? "")).status).toBe(400);
    expect((await revoke(new Headers(), "anything")).status).toBe(401);
  });
});

describe("per-user rate limit on settings mutations (audit #7)", () => {
  it("answers 429 once the caller has made 20 in a minute", async () => {
    const email = "hasty@kola.test";
    const headers = await signUp(email);
    await ctx.db.insert(schema.rateLimit).values({
      id: "settings-limit-test",
      key: `user:${await userId(email)}|orgMutation`,
      count: 20,
      lastRequest: Date.now(),
    });
    const orgId = await createOrg(headers, "Hasty", "hasty-co");
    const res = await call(headers, orgId, "general", {
      name: "Hastier",
      slug: "hasty-co",
    });
    expect(res.status).toBe(429);
    expect((await orgRow(orgId))?.name).toBe("Hasty");
  });
});

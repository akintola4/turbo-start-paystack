import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthError, isAuthError } from "../src/errors";
import { roleHasPermission } from "../src/roles";
import { addMember, createOrg, setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;
let owner: Headers;
let orgId: string;

beforeAll(async () => {
  ctx = await setupAuth();
  owner = await signUp(ctx, "owner@acme.test");
  orgId = (await createOrg(ctx, owner, "acme")).id;
});

afterAll(async () => {
  await ctx.close();
});

async function memberIdByEmail(email: string): Promise<string> {
  const [row] = await ctx.db
    .select({ id: schema.member.id })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.user.email, email));
  if (!row) {
    throw new Error(`no member ${email}`);
  }
  return row.id;
}

describe("role matrix (PLAN §9)", () => {
  it.each([
    ["owner", "billing:manage", true],
    ["admin", "billing:manage", false],
    ["admin", "billing:view", true],
    ["billing", "billing:manage", true],
    ["billing", "invitation:create", false],
    ["member", "billing:view", false],
    ["viewer", "invitation:create", false],
    ["admin", "organization:delete", false],
    ["owner", "organization:delete", true],
  ] as const)("%s %s → %s", (role, permission, expected) => {
    expect(roleHasPermission(role, permission)).toBe(expected);
  });
});

describe("requirePermission (PLAN §2.3 #15: org-scoped only)", () => {
  it("rejects a request with no session as 401", async () => {
    await expect(
      ctx.requirePermission(new Headers(), orgId, "billing:view")
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a signed-in non-member as 403", async () => {
    const stranger = await signUp(ctx, "stranger@else.test");
    // Owning another org gives no rights here.
    await createOrg(ctx, stranger, "elsewhere");
    await expect(
      ctx.requirePermission(stranger, orgId, "billing:view")
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a member without the permission as 403", async () => {
    const member = await addMember(ctx, owner, orgId, "m@acme.test", "member");
    await expect(
      ctx.requirePermission(member, orgId, "billing:manage")
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows the billing role to manage billing", async () => {
    const billing = await addMember(
      ctx,
      owner,
      orgId,
      "b@acme.test",
      "billing"
    );
    const actor = await ctx.requirePermission(billing, orgId, "billing:manage");
    expect(actor).toMatchObject({ email: "b@acme.test", role: "billing" });
  });
});

describe("role changes", () => {
  it("an admin cannot promote anyone to owner or demote the owner", async () => {
    const admin = await addMember(ctx, owner, orgId, "a@acme.test", "admin");
    const targetId = await memberIdByEmail("m@acme.test");
    await expect(
      ctx.auth.api.updateMemberRole({
        headers: admin,
        body: {
          memberId: targetId,
          role: "owner",
          organizationId: orgId,
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    const ownerId = await memberIdByEmail("owner@acme.test");
    await expect(
      ctx.auth.api.updateMemberRole({
        headers: admin,
        body: { memberId: ownerId, role: "viewer", organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("an admin can change a member to billing and it is audited", async () => {
    const targetId = await memberIdByEmail("m@acme.test");
    await ctx.auth.api.updateMemberRole({
      headers: owner,
      body: {
        memberId: targetId,
        role: "billing",
        organizationId: orgId,
      },
    });
    const audits = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "member.update_role"));
    expect(audits).toHaveLength(1);
  });

  it("the last owner cannot be removed", async () => {
    const ownerId = await memberIdByEmail("owner@acme.test");
    await expect(
      ctx.auth.api.removeMember({
        headers: owner,
        body: { memberIdOrEmail: ownerId, organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("a plain member cannot change roles", async () => {
    const viewer = await addMember(ctx, owner, orgId, "v@acme.test", "viewer");
    const targetId = await memberIdByEmail("v@acme.test");
    await expect(
      ctx.auth.api.updateMemberRole({
        headers: viewer,
        body: {
          memberId: targetId,
          role: "admin",
          organizationId: orgId,
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("isAuthError", () => {
  it("recognises an AuthError from another copy of the module", () => {
    class ForeignAuthError extends Error {
      readonly status = 403;
      constructor() {
        super("Missing permission billing:view");
        this.name = "AuthError";
      }
    }
    expect(isAuthError(new AuthError(403, "no"))).toBe(true);
    expect(isAuthError(new ForeignAuthError())).toBe(true);
    expect(isAuthError(new Error("boom"))).toBe(false);
    expect(isAuthError({ name: "AuthError", status: 403 })).toBe(false);
  });
});

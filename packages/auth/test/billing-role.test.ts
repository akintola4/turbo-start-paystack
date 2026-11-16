import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { canGrantRole, grantableRoles } from "../src/roles";
import { addMember, createOrg, setupAuth, signUp, verify } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;

beforeAll(async () => {
  ctx = await setupAuth();
});
afterAll(async () => ctx.close());

describe("the billing role is granted only by owners (audit #12)", () => {
  it("knows who may grant what", () => {
    expect(grantableRoles("owner")).toEqual([
      "owner",
      "admin",
      "billing",
      "member",
      "viewer",
    ]);
    expect(grantableRoles("admin")).toEqual(["admin", "member", "viewer"]);
    expect(canGrantRole("admin", "billing")).toBe(false);
    expect(canGrantRole("admin", "member,billing")).toBe(false);
    expect(canGrantRole("admin", "made-up")).toBe(false);
  });

  it("an admin can't invite or promote anyone to billing; an owner can", async () => {
    const owner = await signUp(ctx, "boss@kolalogistics.test");
    const org = await createOrg(ctx, owner, "kola-roles");
    const admin = await addMember(
      ctx,
      owner,
      org.id,
      "deputy@kolalogistics.test",
      "admin"
    );
    await expect(
      ctx.auth.api.createInvitation({
        headers: admin,
        body: {
          email: "second-account@kolalogistics.test",
          role: "billing",
          organizationId: org.id,
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    await addMember(ctx, owner, org.id, "clerk@kolalogistics.test", "member");
    const [clerk] = await ctx.db
      .select({ id: schema.member.id })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(eq(schema.user.email, "clerk@kolalogistics.test"));
    await expect(
      ctx.auth.api.updateMemberRole({
        headers: admin,
        body: {
          organizationId: org.id,
          memberId: clerk?.id ?? "",
          role: "billing",
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      ctx.auth.api.createInvitation({
        headers: owner,
        body: {
          email: "accountant@kolalogistics.test",
          role: "billing",
          organizationId: org.id,
        },
      })
    ).resolves.toMatchObject({ role: "billing" });
    await expect(
      ctx.auth.api.updateMemberRole({
        headers: owner,
        body: {
          organizationId: org.id,
          memberId: clerk?.id ?? "",
          role: "billing",
        },
      })
    ).resolves.toMatchObject({ role: "billing" });
    await verify(ctx.db, "clerk@kolalogistics.test");
  });

  it("an empty organizationId doesn't let an admin make themselves billing", async () => {
    const owner = await signUp(ctx, "chief@kolalogistics.test");
    const org = await createOrg(ctx, owner, "kola-empty-org");
    const admin = await addMember(
      ctx,
      owner,
      org.id,
      "climber@kolalogistics.test",
      "admin"
    );
    await ctx.auth.api.setActiveOrganization({
      headers: admin,
      body: { organizationId: org.id },
    });
    const [self] = await ctx.db
      .select({ id: schema.member.id })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(eq(schema.user.email, "climber@kolalogistics.test"));
    await expect(
      ctx.auth.api.updateMemberRole({
        headers: admin,
        body: {
          organizationId: "",
          memberId: self?.id ?? "",
          role: ["admin", "billing"],
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    const [after] = await ctx.db
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(eq(schema.member.id, self?.id ?? ""));
    expect(after?.role).toBe("admin");
  });
});

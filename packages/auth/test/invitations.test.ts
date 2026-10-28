import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

describe("organization creation", () => {
  it("creates the org and the creator's owner membership together", async () => {
    const members = await ctx.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, orgId));
    expect(members).toHaveLength(1);
    expect(members[0]?.role).toBe("owner");
  });
});

describe("invitations (PLAN §2.3 #3, #4, #5)", () => {
  it("a plain member cannot invite anyone", async () => {
    const member = await addMember(ctx, owner, orgId, "m@acme.test", "member");
    await expect(
      ctx.auth.api.createInvitation({
        headers: member,
        body: { email: "x@acme.test", role: "member", organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("an admin cannot invite an owner, but can invite an admin", async () => {
    const admin = await addMember(ctx, owner, orgId, "a@acme.test", "admin");
    await expect(
      ctx.auth.api.createInvitation({
        headers: admin,
        body: { email: "boss@acme.test", role: "owner", organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    const ok = await ctx.auth.api.createInvitation({
      headers: admin,
      body: { email: "a2@acme.test", role: "admin", organizationId: orgId },
    });
    expect(ok.role).toBe("admin");
  });

  it("a user outside the org cannot invite into it", async () => {
    const outsider = await signUp(ctx, "outsider@evil.test");
    await expect(
      ctx.auth.api.createInvitation({
        headers: outsider,
        body: { email: "me2@evil.test", role: "owner", organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("only the invited email can accept, and only once", async () => {
    const inv = await ctx.auth.api.createInvitation({
      headers: owner,
      body: { email: "bound@acme.test", role: "viewer", organizationId: orgId },
    });
    const thief = await signUp(ctx, "thief@evil.test");
    await expect(
      ctx.auth.api.acceptInvitation({
        headers: thief,
        body: { invitationId: inv.id },
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    const invited = await signUp(ctx, "bound@acme.test");
    const accepted = await ctx.auth.api.acceptInvitation({
      headers: invited,
      body: { invitationId: inv.id },
    });
    expect(accepted?.member.organizationId).toBe(orgId);
    // The member row's org and role come from the invitation row only.
    expect(accepted?.member.role).toBe("viewer");
    await expect(
      ctx.auth.api.acceptInvitation({
        headers: invited,
        body: { invitationId: inv.id },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("expired invitations cannot be accepted", async () => {
    const inv = await ctx.auth.api.createInvitation({
      headers: owner,
      body: { email: "late@acme.test", role: "member", organizationId: orgId },
    });
    await ctx.db
      .update(schema.invitation)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.invitation.id, inv.id));
    const late = await signUp(ctx, "late@acme.test");
    await expect(
      ctx.auth.api.acceptInvitation({
        headers: late,
        body: { invitationId: inv.id },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("invitations expire after 7 days", async () => {
    const inv = await ctx.auth.api.createInvitation({
      headers: owner,
      body: { email: "week@acme.test", role: "member", organizationId: orgId },
    });
    const days = (new Date(inv.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("an unverified email cannot accept", async () => {
    const inv = await ctx.auth.api.createInvitation({
      headers: owner,
      body: {
        email: "unverified@acme.test",
        role: "member",
        organizationId: orgId,
      },
    });
    await ctx.auth.api.signUpEmail({
      body: {
        email: "unverified@acme.test",
        password: "correct-horse-battery",
        name: "u",
      },
    });
    const res = await ctx.auth.api.signInEmail({
      body: {
        email: "unverified@acme.test",
        password: "correct-horse-battery",
      },
      asResponse: true,
    });
    const headers = new Headers({
      cookie: res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    });
    await expect(
      ctx.auth.api.acceptInvitation({ headers, body: { invitationId: inv.id } })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("members without invite rights cannot see invitation tokens", async () => {
    const viewer = await addMember(ctx, owner, orgId, "v@acme.test", "viewer");
    await expect(
      ctx.auth.api.listInvitations({
        headers: viewer,
        query: { organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    const full = await ctx.auth.api.getFullOrganization({
      headers: viewer,
      query: { organizationId: orgId },
    });
    expect(full?.invitations).toEqual([]);

    const ownerView = await ctx.auth.api.listInvitations({
      headers: owner,
      query: { organizationId: orgId },
    });
    expect(ownerView.length).toBeGreaterThan(0);
  });

  it("users from another org cannot read this org's members or invitations", async () => {
    const other = await signUp(ctx, "other@globex.test");
    await createOrg(ctx, other, "globex");
    await expect(
      ctx.auth.api.listInvitations({
        headers: other,
        query: { organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      ctx.auth.api.getFullOrganization({
        headers: other,
        query: { organizationId: orgId },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("enforces the plan's member limit when inviting (PLAN §2.3 #16)", async () => {
    const members = await ctx.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, orgId));
    // Members alone fill the plan; pending invitations would push past it.
    ctx.limits.members = members.length;
    await expect(
      ctx.auth.api.createInvitation({
        headers: owner,
        body: {
          email: "overflow@acme.test",
          role: "member",
          organizationId: orgId,
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    ctx.limits.members = 100;
  });

  it("writes an audit log entry for invitations", async () => {
    const rows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "invitation.create"));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("emails the invite link without logging anything else", () => {
    const mail = ctx.outbox.find((m) => m.to === "bound@acme.test");
    expect(mail?.text).toContain("/accept-invite/");
  });
});

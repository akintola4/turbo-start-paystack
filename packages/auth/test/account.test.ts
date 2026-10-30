import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addMember, createOrg, setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;
/** Orgs whose delete the billing callback refuses. */
const paid = new Set<string>();

beforeAll(async () => {
  ctx = await setupAuth({
    beforeDeleteOrganization: async (organizationId) =>
      paid.has(organizationId)
        ? { blocked: "Cancel the plan first." }
        : undefined,
  });
});

afterAll(async () => {
  await ctx.close();
});

const PASSWORD = "correct-horse-battery";

describe("deleting an account", () => {
  it("is refused while the user is the only owner of an organization", async () => {
    const owner = await signUp(ctx, "solo@acme.test");
    await createOrg(ctx, owner, "solo-co");
    await expect(
      ctx.auth.api.deleteUser({ headers: owner, body: { password: PASSWORD } })
    ).rejects.toMatchObject({
      statusCode: 400,
      body: { code: "SOLE_OWNER" },
    });
    const [still] = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "solo@acme.test"));
    expect(still).toBeDefined();
  });

  it("goes through once someone else is also an owner", async () => {
    const owner = await signUp(ctx, "first@shared.test");
    const org = await createOrg(ctx, owner, "shared-co");
    const second = await addMember(
      ctx,
      owner,
      org.id,
      "second@shared.test",
      "admin"
    );
    // Both are owners now (a direct update: transfer is tested in the app).
    await ctx.db
      .update(schema.member)
      .set({ role: "owner" })
      .where(eq(schema.member.organizationId, org.id));
    expect(
      await ctx.soleOwnedOrganizations(
        (await ctx.auth.api.getSession({ headers: owner }))?.user.id ?? ""
      )
    ).toEqual([]);
    await ctx.auth.api.deleteUser({
      headers: second,
      body: { password: PASSWORD },
    });
    const gone = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "second@shared.test"));
    expect(gone).toHaveLength(0);
    const audit = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.organizationId, org.id));
    expect(audit.map((a) => a.action)).toContain("member.account_deleted");
  });

  it("a plain member can delete their account", async () => {
    const owner = await signUp(ctx, "boss@plain.test");
    const org = await createOrg(ctx, owner, "plain-co");
    const member = await addMember(
      ctx,
      owner,
      org.id,
      "m@plain.test",
      "member"
    );
    await ctx.auth.api.deleteUser({
      headers: member,
      body: { password: PASSWORD },
    });
    const members = await ctx.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, org.id));
    expect(members).toHaveLength(1);
  });
});

describe("changing email", () => {
  it("sends the link to the new address only, and shows it as pending", async () => {
    const headers = await signUp(ctx, "old@mail.test");
    ctx.outbox.length = 0;
    await ctx.auth.api.changeEmail({
      headers,
      body: { newEmail: "New@Mail.test", callbackURL: "/app/account" },
    });
    expect(ctx.outbox.map((m) => m.to)).toEqual(["new@mail.test"]);
    expect(ctx.outbox[0]?.subject).toBe("Confirm your new email address");
    const session = await ctx.auth.api.getSession({ headers });
    const pending = await ctx.pendingEmail(
      session?.user.id ?? "",
      session?.user.email ?? ""
    );
    expect(pending?.email).toBe("new@mail.test");
    // Nothing changes until the link is used.
    expect(session?.user.email).toBe("old@mail.test");
  });

  it("no longer reports a pending address once it is the account's", async () => {
    const headers = await signUp(ctx, "before@mail.test");
    await ctx.auth.api.changeEmail({
      headers,
      body: { newEmail: "after@mail.test" },
    });
    const session = await ctx.auth.api.getSession({ headers });
    const userId = session?.user.id ?? "";
    expect(await ctx.pendingEmail(userId, "after@mail.test")).toBeNull();
  });
});

describe("organization slugs and deletion", () => {
  it("a reserved slug can't be taken or reported as free", async () => {
    const owner = await signUp(ctx, "slugs@acme.test");
    await expect(
      ctx.auth.api.createOrganization({
        headers: owner,
        body: { name: "Account", slug: "account" },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      ctx.auth.api.checkOrganizationSlug({
        headers: owner,
        body: { slug: "account" },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("the billing callback can refuse a delete, and the org stays", async () => {
    const owner = await signUp(ctx, "paid@acme.test");
    const org = await createOrg(ctx, owner, "paid-co");
    paid.add(org.id);
    await expect(
      ctx.auth.api.deleteOrganization({
        headers: owner,
        body: { organizationId: org.id },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      body: { message: "Cancel the plan first." },
    });
    paid.delete(org.id);
    await ctx.auth.api.deleteOrganization({
      headers: owner,
      body: { organizationId: org.id },
    });
    const rows = await ctx.db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, org.id));
    expect(rows).toHaveLength(0);
  });
});

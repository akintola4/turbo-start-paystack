import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { linkIn, mailTo, PASSWORD, setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;

beforeAll(async () => {
  ctx = await setupAuth();
});
afterAll(async () => ctx.close());

describe("changing email (audit #6)", () => {
  it("needs the current password, and sends nothing without it", async () => {
    const headers = await signUp(ctx, "guarded@kolalogistics.test");
    ctx.outbox.length = 0;
    for (const body of [
      { newEmail: "thief@example.test" },
      { newEmail: "thief@example.test", password: "not-the-password" },
    ]) {
      await expect(
        ctx.auth.api.changeEmail({
          headers,
          body: body as { newEmail: string },
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { code: "INVALID_PASSWORD" },
      });
    }
    expect(ctx.outbox).toEqual([]);
  });

  it("asks the old address to approve, then the new address to confirm, then switches", async () => {
    const oldEmail = "moving@kolalogistics.test";
    const newEmail = "moved@kolalogistics.test";
    const headers = await signUp(ctx, oldEmail);
    ctx.outbox.length = 0;
    await ctx.auth.api.changeEmail({
      headers,
      body: {
        newEmail,
        password: PASSWORD,
        callbackURL: "/app/account",
      } as { newEmail: string },
    });
    const approval = mailTo(ctx, oldEmail).at(-1);
    expect(approval?.subject).toBe("Approve the change to your email address");
    expect(approval?.text).toContain(newEmail);
    expect(mailTo(ctx, newEmail)).toEqual([]);

    // Approving from the old inbox sends the confirmation to the new one.
    await ctx.auth.handler(
      new Request(linkIn(approval?.text ?? "", "/verify-email"))
    );
    const confirm = mailTo(ctx, newEmail).at(-1);
    expect(confirm?.subject).toBe("Confirm your new email address");
    let [user] = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, oldEmail));
    expect(user).toBeDefined();

    await ctx.auth.handler(
      new Request(linkIn(confirm?.text ?? "", "/verify-email"))
    );
    [user] = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, newEmail));
    expect(user?.emailVerified).toBe(true);
  });
});

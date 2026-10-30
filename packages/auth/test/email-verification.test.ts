import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cookieOf,
  linkIn,
  mailTo,
  ORIGIN,
  PASSWORD,
  post,
  setupAuth,
  signUp,
} from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;

beforeAll(async () => {
  ctx = await setupAuth();
});
afterAll(async () => ctx.close());

describe("email verification is required to sign in (audit #5)", () => {
  it("sign-up sends the link and gives no session; sign-in is refused and resends it", async () => {
    const email = "fresh@kolalogistics.test";
    const res = await post(
      ctx,
      "/sign-up/email",
      { email, password: PASSWORD, name: "Fresh", callbackURL: "/app" },
      { ip: "198.51.100.1" }
    );
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(mailTo(ctx, email).map((m) => m.subject)).toEqual([
      "Confirm your email address",
    ]);

    const signIn = await post(
      ctx,
      "/sign-in/email",
      { email, password: PASSWORD },
      { ip: "198.51.100.1" }
    );
    expect(signIn.status).toBe(403);
    expect(await signIn.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(signIn.headers.getSetCookie()).toEqual([]);
    expect(mailTo(ctx, email)).toHaveLength(2);

    // The link verifies the address and signs the user in.
    const verified = await ctx.auth.handler(
      new Request(
        linkIn(mailTo(ctx, email).at(-1)?.text ?? "", "/verify-email")
      )
    );
    expect(verified.status).toBe(302);
    const [user] = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email));
    expect(user?.emailVerified).toBe(true);
    const ok = await post(
      ctx,
      "/sign-in/email",
      { email, password: PASSWORD },
      { ip: "198.51.100.1" }
    );
    expect(ok.status).toBe(200);
  });

  it("a password reset signs out every existing session", async () => {
    const email = "reset@kolalogistics.test";
    const laptop = await signUp(ctx, email);
    const res = await ctx.auth.api.signInEmail({
      body: { email, password: PASSWORD },
      asResponse: true,
    });
    const phone = new Headers({ cookie: cookieOf(res) });
    expect(await ctx.auth.api.getSession({ headers: phone })).not.toBeNull();

    await ctx.auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
    });
    const landing = await ctx.auth.handler(
      new Request(
        linkIn(mailTo(ctx, email).at(-1)?.text ?? "", "/reset-password/")
      )
    );
    const token = new URL(
      landing.headers.get("location") ?? "",
      ORIGIN
    ).searchParams.get("token");
    await ctx.auth.api.resetPassword({
      body: { token: token ?? "", newPassword: "a-whole-new-password" },
    });

    expect(await ctx.auth.api.getSession({ headers: laptop })).toBeNull();
    expect(await ctx.auth.api.getSession({ headers: phone })).toBeNull();
  });
});

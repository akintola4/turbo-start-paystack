import { schema } from "@workspace/db";
import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { consumeRateLimit, userRateLimit } from "../src/rate-limit";
import { AUTH_RATE_LIMITS } from "../src/server";
import { createOrg, post, setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;

beforeAll(async () => {
  ctx = await setupAuth();
});
afterAll(async () => ctx.close());

describe("rate limits (audit #7)", () => {
  async function tripsAfter(
    path: keyof typeof AUTH_RATE_LIMITS,
    body: unknown,
    options: { ip: string; cookie?: string }
  ) {
    const { max } = AUTH_RATE_LIMITS[path];
    for (let i = 0; i < max; i++) {
      const res = await post(ctx, path, body, options);
      expect(res.status, `${path} request ${i + 1}`).not.toBe(429);
    }
    const res = await post(ctx, path, body, options);
    expect(res.status, `${path} request ${max + 1}`).toBe(429);
  }

  it("stores Better Auth's counters in the database", async () => {
    await post(
      ctx,
      "/sign-in/email",
      { email: "nobody@kolalogistics.test", password: "wrong-password" },
      { ip: "203.0.113.50" }
    );
    const rows = await ctx.db
      .select()
      .from(schema.rateLimit)
      .where(like(schema.rateLimit.key, "203.0.113.50|%"));
    expect(rows.map((r) => r.key)).toEqual(["203.0.113.50|/sign-in/email"]);
  });

  it("trips on sign-in, sign-up, password reset, verification and change-email", async () => {
    await tripsAfter(
      "/sign-in/email",
      { email: "nobody@kolalogistics.test", password: "wrong-password" },
      { ip: "203.0.113.1" }
    );
    await tripsAfter(
      "/sign-up/email",
      { email: "x@kolalogistics.test", password: "short", name: "x" },
      { ip: "203.0.113.2" }
    );
    await tripsAfter(
      "/request-password-reset",
      { email: "nobody@kolalogistics.test", redirectTo: "/reset-password" },
      { ip: "203.0.113.3" }
    );
    await tripsAfter(
      "/reset-password",
      { token: "nope", newPassword: "a-whole-new-password" },
      { ip: "203.0.113.4" }
    );
    await tripsAfter(
      "/send-verification-email",
      { email: "nobody@kolalogistics.test" },
      { ip: "203.0.113.5" }
    );
    const headers = await signUp(ctx, "limited@kolalogistics.test");
    await tripsAfter(
      "/change-email",
      { newEmail: "elsewhere@kolalogistics.test", password: "wrong" },
      { ip: "203.0.113.6", cookie: headers.get("cookie") ?? "" }
    );
  });

  it("trips on invitations", async () => {
    const owner = await signUp(ctx, "inviter@kolalogistics.test");
    const org = await createOrg(ctx, owner, "invite-heavy");
    ctx.limits.members = 1000;
    const { max } = AUTH_RATE_LIMITS["/organization/invite-member"];
    const cookie = owner.get("cookie") ?? "";
    for (let i = 0; i < max; i++) {
      const res = await post(
        ctx,
        "/organization/invite-member",
        {
          email: `guest${i}@kolalogistics.test`,
          role: "member",
          organizationId: org.id,
        },
        { ip: "203.0.113.7", cookie }
      );
      expect(res.status).toBe(200);
    }
    const res = await post(
      ctx,
      "/organization/invite-member",
      {
        email: "one-too-many@kolalogistics.test",
        role: "member",
        organizationId: org.id,
      },
      { ip: "203.0.113.7", cookie }
    );
    expect(res.status).toBe(429);
    ctx.limits.members = 100;
  });

  it("per-user limits on the app's routes share the table and reset after the window", async () => {
    const rule = { window: 60, max: 2 };
    const t0 = 1_800_000_000_000;
    expect(
      (await consumeRateLimit(ctx.db, "user:u1|t", rule, t0)).allowed
    ).toBe(true);
    expect(
      (await consumeRateLimit(ctx.db, "user:u1|t", rule, t0 + 1000)).allowed
    ).toBe(true);
    const third = await consumeRateLimit(ctx.db, "user:u1|t", rule, t0 + 2000);
    expect(third).toEqual({ allowed: false, retryAfter: 58 });
    // Another user is counted separately.
    expect(
      (await consumeRateLimit(ctx.db, "user:u2|t", rule, t0 + 2000)).allowed
    ).toBe(true);
    // The window passes.
    expect(
      (await consumeRateLimit(ctx.db, "user:u1|t", rule, t0 + 61_000)).allowed
    ).toBe(true);

    let last: Response | null = null;
    for (let i = 0; i < 21; i++) {
      last = await userRateLimit(ctx.db, "u3", "invoicePdf", t0);
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBe("60");
  });
});

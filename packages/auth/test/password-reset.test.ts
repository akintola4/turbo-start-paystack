import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;
const EMAIL = "locked-out@acme.test";

beforeAll(async () => {
  ctx = await setupAuth();
  await signUp(ctx, EMAIL);
});

afterAll(async () => {
  await ctx.close();
});

const resetEmails = () =>
  ctx.outbox.filter((m) => m.subject.toLowerCase().includes("password"));

function linkIn(text: string) {
  const match = text.match(
    /http:\/\/localhost:3000\/api\/auth\/reset-password\/\S+/
  );
  if (!match) {
    throw new Error("no reset link in the email");
  }
  return match[0];
}

describe("forgot password", () => {
  it("emails a link that lands on /reset-password with a token, and the new password works", async () => {
    await ctx.auth.api.requestPasswordReset({
      body: { email: EMAIL, redirectTo: "/reset-password" },
    });
    const email = resetEmails().at(-1);
    expect(email?.to).toBe(EMAIL);

    const landing = await ctx.auth.handler(
      new Request(linkIn(email?.text ?? ""))
    );
    const location = new URL(
      landing.headers.get("location") ?? "",
      "http://localhost:3000"
    );
    expect(location.pathname).toBe("/reset-password");
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();

    await ctx.auth.api.resetPassword({
      body: { token: token ?? "", newPassword: "a-brand-new-password" },
    });
    await expect(
      ctx.auth.api.signInEmail({
        body: { email: EMAIL, password: "a-brand-new-password" },
      })
    ).resolves.toMatchObject({ user: { email: EMAIL } });
    await expect(
      ctx.auth.api.signInEmail({
        body: { email: EMAIL, password: "correct-horse-battery" },
      })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("answers the same for an unknown address and sends nothing", async () => {
    const before = resetEmails().length;
    await expect(
      ctx.auth.api.requestPasswordReset({
        body: { email: "nobody@acme.test", redirectTo: "/reset-password" },
      })
    ).resolves.toMatchObject({ status: true });
    expect(resetEmails()).toHaveLength(before);
  });

  it("rejects a used or made-up token", async () => {
    await expect(
      ctx.auth.api.resetPassword({
        body: { token: "not-a-real-token", newPassword: "another-password-1" },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("limits reset requests to three a minute from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await ctx.auth.handler(
        new Request("http://localhost:3000/api/auth/request-password-reset", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.7",
          },
          body: JSON.stringify({ email: EMAIL, redirectTo: "/reset-password" }),
        })
      );
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { personNameProblem } from "../src/org-rules";
import { setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;
beforeAll(async () => {
  ctx = await setupAuth();
});
afterAll(async () => ctx.close());

// A name is printed in invitation emails to other people, so it can't be
// used to put a link in front of them.
describe("person names", () => {
  it("allows ordinary names and refuses links", () => {
    expect(personNameProblem("Adaeze Okafor-Nwosu")).toBeNull();
    expect(personNameProblem("Tunde O.")).toBeNull();
    expect(personNameProblem("Claim at https://evil.test")).not.toBeNull();
    expect(personNameProblem("www.evil.test support")).not.toBeNull();
    expect(personNameProblem("x".repeat(81))).not.toBeNull();
    expect(personNameProblem("   ")).not.toBeNull();
  });

  it("sign-up and update-user enforce it", async () => {
    await expect(
      ctx.auth.api.signUpEmail({
        body: {
          email: "phish@evil.test",
          password: "correct-horse-battery",
          name: "Verify now at https://evil.test",
        },
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    const headers = await signUp(ctx, "fine@acme.test");
    await expect(
      ctx.auth.api.updateUser({
        headers,
        body: { name: "www.evil.test/login" },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      ctx.auth.api.updateUser({ headers, body: { name: "Fine Person" } })
    ).resolves.toBeTruthy();
  });
});

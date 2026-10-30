import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createOrg, setupAuth, signUp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupAuth>>;

beforeAll(async () => {
  ctx = await setupAuth();
});
afterAll(async () => ctx.close());

describe("organization fields through Better Auth's own endpoints (audit #8)", () => {
  it("rejects bad slugs and names on create and update", async () => {
    const owner = await signUp(ctx, "namer@kolalogistics.test");
    for (const body of [
      { name: "Kola", slug: "Kola Logistics" },
      { name: "Kola", slug: "-kola" },
      { name: "Kola", slug: "ko" },
      { name: "Kola", slug: "k".repeat(49) },
    ]) {
      await expect(
        ctx.auth.api.createOrganization({ headers: owner, body })
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { code: "INVALID_SLUG" },
      });
    }
    for (const name of ["   ", "n".repeat(65)]) {
      await expect(
        ctx.auth.api.createOrganization({
          headers: owner,
          body: { name, slug: "kola-names" },
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { code: "INVALID_NAME" },
      });
    }
    const org = await createOrg(ctx, owner, "kola-names");
    await expect(
      ctx.auth.api.updateOrganization({
        headers: owner,
        body: { organizationId: org.id, data: { slug: "Not OK" } },
      })
    ).rejects.toMatchObject({ body: { code: "INVALID_SLUG" } });
    await expect(
      ctx.auth.api.updateOrganization({
        headers: owner,
        body: { organizationId: org.id, data: { name: "x".repeat(65) } },
      })
    ).rejects.toMatchObject({ body: { code: "INVALID_NAME" } });
    const updated = await ctx.auth.api.updateOrganization({
      headers: owner,
      body: { organizationId: org.id, data: { name: "Kola Freight" } },
    });
    expect(updated?.name).toBe("Kola Freight");
  });
});

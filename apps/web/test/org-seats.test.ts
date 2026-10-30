import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { orgSeats } from "../src/server/seats";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
const NOW = new Date("2026-10-30T12:00:00Z");

beforeAll(async () => {
  ctx = await createTestDb();
  const { db } = ctx;
  await db
    .insert(schema.user)
    .values({ id: "u1", name: "Ada", email: "ada@kolalogistics.test" });
  await db
    .insert(schema.organization)
    .values({ id: "org1", name: "Kola Logistics", slug: "kola-logistics" });
  await db
    .insert(schema.member)
    .values({ id: "m1", organizationId: "org1", userId: "u1", role: "owner" });
  await db.insert(schema.invitation).values([
    {
      id: "i1",
      organizationId: "org1",
      email: "tunde@kolalogistics.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2026-11-06T12:00:00Z"),
      inviterId: "u1",
    },
    // Expired and accepted invitations hold no seat.
    {
      id: "i2",
      organizationId: "org1",
      email: "old@kolalogistics.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2026-10-01T12:00:00Z"),
      inviterId: "u1",
    },
    {
      id: "i3",
      organizationId: "org1",
      email: "done@kolalogistics.test",
      role: "member",
      status: "accepted",
      expiresAt: new Date("2026-11-06T12:00:00Z"),
      inviterId: "u1",
    },
  ]);
});
afterAll(async () => ctx.close());

describe("orgSeats", () => {
  it("counts members plus live pending invitations, as Overview does", async () => {
    expect(await orgSeats(ctx.db, "org1", 50, NOW)).toEqual({
      used: 2,
      max: 50,
      full: false,
      pct: 4,
      pending: 1,
    });
  });
});

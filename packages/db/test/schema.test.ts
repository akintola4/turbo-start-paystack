import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../src/client";
import { eq } from "drizzle-orm";

import {
  invoice,
  organization,
  planPrice,
  subscription,
  webhookEvent,
} from "../src/schema";
import { createTestDb } from "../src/testing";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(organization).values([
    { id: "org_a", name: "A", slug: "a" },
    { id: "org_b", name: "B", slug: "b" },
  ]);
  await db.insert(planPrice).values({
    id: "pro-monthly-ngn",
    planKey: "pro",
    interval: "monthly",
    currency: "NGN",
    amountSubunit: 1_500_000,
  });
});

afterAll(async () => {
  await close();
});

const sub = (
  id: string,
  organizationId: string,
  status: "active" | "canceled"
) => ({
  id,
  organizationId,
  planPriceId: "pro-monthly-ngn",
  status,
  currency: "NGN",
});

describe("schema invariants", () => {
  it("allows only one live subscription per organization", async () => {
    await db.insert(subscription).values(sub("s1", "org_a", "active"));
    await expect(
      db.insert(subscription).values(sub("s2", "org_a", "active"))
    ).rejects.toThrow();
  });

  it("allows a canceled subscription next to a live one", async () => {
    await db.insert(subscription).values(sub("s3", "org_a", "canceled"));
    await db.insert(subscription).values(sub("s4", "org_b", "active"));
    const rows = await db.select().from(subscription);
    expect(rows).toHaveLength(3);
  });

  it("rejects a duplicate webhook dedupe key", async () => {
    const event = {
      eventType: "charge.success",
      dedupeKey: "abc",
      payload: { event: "charge.success" },
    };
    await db.insert(webhookEvent).values({ id: "e1", ...event });
    await expect(
      db.insert(webhookEvent).values({ id: "e2", ...event })
    ).rejects.toThrow();
  });

  it("stores money as exact integers", async () => {
    const [row] = await db.select().from(planPrice);
    expect(row?.amountSubunit).toBe(1_500_000);
  });

  it("keeps an organization's invoices when it is deleted", async () => {
    await db
      .insert(organization)
      .values({ id: "org_gone", name: "Gone Ltd", slug: "gone" });
    await db.insert(subscription).values(sub("s_gone", "org_gone", "active"));
    await db.insert(invoice).values({
      id: "inv_gone",
      organizationId: "org_gone",
      subscriptionId: "s_gone",
      amountSubunit: 1_500_000,
      currency: "NGN",
      status: "paid",
      number: "INV-2026-000042",
      buyer: { name: "Gone Ltd" },
    });

    await db.delete(organization).where(eq(organization.id, "org_gone"));

    const [kept] = await db
      .select()
      .from(invoice)
      .where(eq(invoice.id, "inv_gone"));
    expect(kept).toMatchObject({
      organizationId: "org_gone",
      subscriptionId: null,
      number: "INV-2026-000042",
      amountSubunit: 1_500_000,
      buyer: { name: "Gone Ltd" },
    });
    expect(
      await db.select().from(subscription).where(eq(subscription.id, "s_gone"))
    ).toHaveLength(0);
  });
});

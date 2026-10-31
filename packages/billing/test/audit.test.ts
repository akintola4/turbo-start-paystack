import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { audit } from "../src/service/context";
import { type BillingHarness, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

describe("audit", () => {
  it("links the row to an organization that exists", async () => {
    const { organizationId } = await h.createOrg();
    await audit(h.db, { organizationId, action: "test.live_org" });
    const [row] = await h.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "test.live_org"));
    expect(row?.organizationId).toBe(organizationId);
  });

  it("writes an unlinked row for a deleted organization instead of failing", async () => {
    await audit(h.db, {
      organizationId: "org_deleted",
      action: "paystack.refund.processed",
      data: { status: "processed" },
    });
    const [row] = await h.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "paystack.refund.processed"));
    expect(row?.organizationId).toBeNull();
    expect(row?.data).toEqual({
      status: "processed",
      deletedOrganizationId: "org_deleted",
    });
  });
});

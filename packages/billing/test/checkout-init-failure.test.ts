import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type BillingHarness, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

// A payment intent whose Paystack transaction was never created would sit
// in the database with a known reference, waiting for a forged charge.
describe("checkout when Paystack refuses to initialize", () => {
  it("leaves no payment intent behind", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    h.fake.failNext("POST", /^\/transaction\/initialize/, 400, "Invalid key");
    await expect(
      h.billing.startCheckout({ ...org, planPriceId: "pro-monthly-ngn" })
    ).rejects.toThrow();
    const intents = await h.db
      .select()
      .from(schema.paymentIntent)
      .where(eq(schema.paymentIntent.organizationId, org.organizationId));
    expect(intents).toEqual([]);
  });
});

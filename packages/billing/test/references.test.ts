import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { newReference } from "../src/service/context";
import { type BillingHarness, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

describe("transaction references", () => {
  it("use only the characters Paystack allows", () => {
    // "Only -, ., = and alphanumeric characters allowed."
    // https://paystack.com/docs/api/transaction/
    for (let i = 0; i < 20; i += 1) {
      expect(newReference()).toMatch(/^[A-Za-z0-9.=-]+$/);
    }
    expect(newReference()).toMatch(/^tsp-[0-9a-f]{32}$/);
  });

  it("still apply a charge for a reference from before (tsp_…)", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "pro-monthly-ngn",
    });
    const legacy = checkout.reference.replace(/^tsp-/, "tsp_");
    await h.db
      .update(schema.paymentIntent)
      .set({ id: legacy })
      .where(eq(schema.paymentIntent.id, checkout.reference));
    const tx = h.fake.transactions.get(checkout.reference);
    if (!tx) {
      throw new Error("no transaction");
    }
    h.fake.transactions.delete(checkout.reference);
    h.fake.transactions.set(legacy, { ...tx, reference: legacy });

    const paid = h.pay(legacy);
    await h.deliver(paid.charge);

    expect(
      (await h.billing.confirmByReference(org.organizationId, legacy))
        .paymentStatus
    ).toBe("succeeded");
    expect(
      (await h.billing.getSubscription(org.organizationId))?.planPriceId
    ).toBe("pro-monthly-ngn");
  });
});

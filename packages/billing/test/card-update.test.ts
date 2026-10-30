import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptSecret } from "../src/crypto";
import { chargeSuccess, testAuthorization } from "../src/fixtures";
import { type BillingHarness, KEY, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

const newCard = testAuthorization({
  authorization_code: "AUTH_newcard01",
  last4: "1234",
  exp_month: "09",
  exp_year: "2031",
  brand: "mastercard",
  signature: "SIG_newcard01",
});

describe("card updated on Paystack's manage page", () => {
  it("stores the subscription's new authorization from Paystack", async () => {
    const { organizationId, sub } = await h.subscribe("pro-monthly-ngn");
    expect(sub.cardLast4).toBe("4081");

    // Paystack charges the new card as a one-off transaction (no plan).
    const charge = h.fake.updateCard(
      sub.paystackSubscriptionCode ?? "",
      newCard
    );
    const event = await h.deliver(chargeSuccess(charge));
    expect(event?.error).toBeNull();

    const after = await h.billing.getSubscription(organizationId);
    expect(after).toMatchObject({
      cardLast4: "1234",
      cardBrand: "mastercard",
      cardExp: "09/2031",
      authorizationSignature: "SIG_newcard01",
    });
    expect(decryptSecret(after?.authorizationCode ?? "", KEY)).toBe(
      "AUTH_newcard01"
    );
    // Nothing billed: no invoice for the card update.
    const invoices = await h.billing.listInvoices(organizationId);
    expect(invoices.map((i) => i.reference)).not.toContain(charge.reference);
  });

  it("retries a card update until Paystack moves the subscription onto it", async () => {
    const { organizationId, sub } = await h.subscribe("pro-monthly-ngn");
    const code = sub.paystackSubscriptionCode ?? "";
    const charge = h.fake.updateCard(code, newCard, { adopt: false });
    expect(charge.metadata.transaction_type).toBe("update_card");

    // The webhook arrives before Paystack has switched the card: kept for retry.
    const event = await h.deliver(chargeSuccess(charge));
    expect(event).toMatchObject({
      error: "card update not on the subscription yet",
      processedAt: null,
    });
    expect((await h.billing.getSubscription(organizationId))?.cardLast4).toBe(
      "4081"
    );

    // Paystack switches it; reconcile's retry records the new card.
    h.fake.adoptCard(code, newCard);
    await h.billing.processEvent(event?.id ?? "");
    expect(await h.billing.getSubscription(organizationId)).toMatchObject({
      cardLast4: "1234",
      cardExp: "09/2031",
    });
  });

  it("leaves the card alone for a one-off charge on another card", async () => {
    const { organizationId, sub, paid } = await h.subscribe("pro-monthly-ngn");
    const event = await h.deliver(
      chargeSuccess({
        reference: `oneoff_${organizationId}`,
        amount: 5000,
        currency: "NGN",
        customer: paid.customer,
        authorization: testAuthorization({
          authorization_code: "AUTH_unrelated",
          last4: "9999",
        }),
      })
    );
    expect(event?.error).toBe("charge not linked to a subscription");
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.cardLast4).toBe(sub.cardLast4);
    expect(after?.authorizationCode).toBe(sub.authorizationCode);
  });
});

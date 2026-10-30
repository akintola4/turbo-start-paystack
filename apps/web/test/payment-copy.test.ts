import { describe, expect, it } from "vitest";

import {
  billingEmailHint,
  freeTileCopy,
  paymentOutcome,
  paystackEmailNote,
} from "../src/lib/payment-copy";

const sub = {
  planName: "Pro",
  priceLabel: "₦30,000.00",
  trialEndsAt: "2026-11-12T00:00:00.000Z",
};

describe("paymentOutcome", () => {
  it("says a trial started, not that a payment was confirmed", () => {
    const out = paymentOutcome("succeeded", { ...sub, status: "trialing" });
    expect(out.title).toBe("Trial started");
    expect(out.description).toContain("First charge ₦30,000.00 on 12 Nov");
    expect(`${out.title} ${out.description}`).not.toMatch(/payment confirmed/i);
  });

  it("names the amount and the plan when money was taken", () => {
    const out = paymentOutcome("succeeded", { ...sub, status: "active" });
    expect(out).toMatchObject({
      kind: "success",
      title: "₦30,000.00 paid",
      description: "Pro is active.",
    });
  });

  it("keeps waiting, then gives up politely", () => {
    expect(paymentOutcome("created", null).kind).toBe("loading");
    expect(paymentOutcome("created", null, { gaveUp: true }).kind).toBe("info");
  });

  it("says nothing was charged when checkout failed or was abandoned", () => {
    for (const status of ["failed", "abandoned"]) {
      expect(paymentOutcome(status, null)).toMatchObject({
        kind: "error",
        description: expect.stringContaining("Nothing was charged"),
      });
    }
  });
});

describe("freeTileCopy", () => {
  const base = {
    planName: "Pro",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2027-03-12T00:00:00.000Z",
  };

  it("points at Cancel only when Cancel is on the page", () => {
    expect(freeTileCopy({ ...base, status: "active" })).toMatch(
      /cancel your plan above/
    );
    expect(freeTileCopy({ ...base, status: "past_due" })).not.toMatch(
      /cancel/i
    );
    expect(freeTileCopy({ ...base, status: "non_renewing" })).toBe(
      "Pro already ends 12 Mar; then you're on Free."
    );
    expect(
      freeTileCopy({ ...base, status: "active", cancelAtPeriodEnd: true })
    ).toMatch(/already ends/);
  });
});

describe("paystackEmailNote", () => {
  it("names the tagged address the first checkout will use", () => {
    const note = paystackEmailNote(
      {
        email: "ada+3f9a2c1b@kolalogistics.test",
        locked: false,
        source: "tagged",
      },
      false
    );
    expect(note).toContain(
      "Paystack will bill this organization as ada+3f9a2c1b@kolalogistics.test"
    );
    expect(note).toContain("Set a billing email in Billing details");
  });

  it("names the billing email without suggesting one", () => {
    const note = paystackEmailNote(
      {
        email: "accounts@lagosbakery.test",
        locked: false,
        source: "billing_email",
      },
      false
    );
    expect(note).toBe(
      "Paystack will bill this organization as accounts@lagosbakery.test and send receipts there."
    );
  });

  it("states a locked address and says nothing once subscribed", () => {
    const locked = {
      email: "ada@kolalogistics.test",
      locked: true,
      source: null,
    };
    expect(paystackEmailNote(locked, false)).toBe(
      "Paystack bills this organization as ada@kolalogistics.test and sends receipts there."
    );
    expect(paystackEmailNote(locked, true)).toBeNull();
    expect(paystackEmailNote(null, false)).toBeNull();
  });
});

describe("billingEmailHint", () => {
  it("explains the billing email before the first payment", () => {
    expect(billingEmailHint(null)).toContain(
      "before the first payment to give this organization its own Paystack address"
    );
  });

  it("says the Paystack address no longer changes after it", () => {
    expect(
      billingEmailHint({
        email: "ada@kolalogistics.test",
        locked: true,
        source: null,
      })
    ).toBe(
      "Paystack keeps billing ada@kolalogistics.test. The billing email only changes what invoices show."
    );
  });
});

import { describe, expect, it } from "vitest";

import { freeTileCopy, paymentOutcome } from "../src/lib/payment-copy";

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

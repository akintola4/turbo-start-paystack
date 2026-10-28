import { describe, expect, it } from "vitest";

import { getEntitlement, RENEWAL_LEEWAY_MS } from "../src/entitlements";
import { computeProration } from "../src/proration";

const start = new Date("2026-03-01T00:00:00Z");
const end = new Date("2026-03-31T00:00:00Z");
const mid = new Date("2026-03-16T00:00:00Z");

describe("computeProration", () => {
  it("charges the difference for the remaining half period", () => {
    const p = computeProration({
      oldAmount: 1_000_000,
      oldInterval: "monthly",
      newAmount: 3_000_000,
      newInterval: "monthly",
      periodStart: start,
      periodEnd: end,
      now: mid,
    });
    expect(p.remainingFraction).toBe(0.5);
    expect(p.credit).toBe(500_000);
    expect(p.cost).toBe(1_500_000);
    expect(p.charge).toBe(1_000_000);
  });

  it("charges nothing once the period is over", () => {
    const p = computeProration({
      oldAmount: 1_000_000,
      oldInterval: "monthly",
      newAmount: 3_000_000,
      newInterval: "monthly",
      periodStart: start,
      periodEnd: end,
      now: new Date("2026-04-02T00:00:00Z"),
    });
    expect(p.charge).toBe(0);
  });

  it("never charges a negative amount on a cheaper plan", () => {
    const p = computeProration({
      oldAmount: 3_000_000,
      oldInterval: "monthly",
      newAmount: 1_000_000,
      newInterval: "monthly",
      periodStart: start,
      periodEnd: end,
      now: mid,
    });
    expect(p.charge).toBe(0);
  });

  it("returns whole subunits", () => {
    const p = computeProration({
      oldAmount: 1001,
      oldInterval: "monthly",
      newAmount: 3007,
      newInterval: "monthly",
      periodStart: start,
      periodEnd: end,
      now: new Date("2026-03-11T07:00:00Z"),
    });
    expect(Number.isInteger(p.charge)).toBe(true);
  });

  it("scales an annual plan down to the current monthly period", () => {
    const p = computeProration({
      oldAmount: 1000,
      oldInterval: "monthly",
      newAmount: 36_500,
      newInterval: "annually",
      periodStart: start,
      periodEnd: end,
      now: mid,
    });
    // 36,500/yr is 3,000 per 30-day period; half of it minus half of 1,000.
    expect(p.charge).toBe(1000);
  });
});

const base = {
  planPriceId: "pro-monthly-ngn",
  currentPeriodEnd: end,
  trialEndsAt: null,
  graceUntil: null,
};

describe("getEntitlement (PLAN §2.3 #7)", () => {
  it("is free without a subscription", () => {
    expect(getEntitlement(null, mid)).toMatchObject({
      active: false,
      plan: { key: "free" },
    });
  });

  it("grants the plan while active", () => {
    expect(getEntitlement({ ...base, status: "active" }, mid)).toMatchObject({
      active: true,
      plan: { key: "pro" },
    });
  });

  it("stops an active subscription whose period ended with no renewal", () => {
    const later = new Date(end.getTime() + RENEWAL_LEEWAY_MS + 1);
    expect(getEntitlement({ ...base, status: "active" }, later).active).toBe(
      false
    );
  });

  it("keeps non-renewing access until the period end, then stops", () => {
    expect(
      getEntitlement({ ...base, status: "non_renewing" }, mid).active
    ).toBe(true);
    expect(
      getEntitlement(
        { ...base, status: "non_renewing" },
        new Date(end.getTime() + 1)
      ).active
    ).toBe(false);
  });

  it("allows past_due only within the grace period", () => {
    const sub = {
      ...base,
      status: "past_due" as const,
      graceUntil: new Date("2026-03-20T00:00:00Z"),
    };
    expect(getEntitlement(sub, mid)).toMatchObject({
      active: true,
      reason: "past_due_grace",
    });
    expect(getEntitlement(sub, new Date("2026-03-21T00:00:00Z")).active).toBe(
      false
    );
  });

  it("never grants canceled or expired", () => {
    expect(getEntitlement({ ...base, status: "canceled" }, mid).active).toBe(
      false
    );
    expect(getEntitlement({ ...base, status: "expired" }, mid).active).toBe(
      false
    );
  });

  it("grants a trial until it ends", () => {
    const sub = {
      ...base,
      status: "trialing" as const,
      trialEndsAt: new Date("2026-03-20T00:00:00Z"),
    };
    expect(getEntitlement(sub, mid).reason).toBe("trialing");
    expect(getEntitlement(sub, new Date("2026-03-22T00:00:00Z")).active).toBe(
      false
    );
  });
});

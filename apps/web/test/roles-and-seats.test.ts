import { describe, expect, it } from "vitest";

import { planState } from "../src/lib/plan-state";
import { seatUsage } from "../src/lib/seats";

const pro = {
  status: "active" as const,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2027-03-12T00:00:00.000Z",
};

describe("planState (what every role sees)", () => {
  it("gives a member the real plan and status, not Free", () => {
    expect(planState("Pro", pro, { withDates: false })).toEqual({
      name: "Pro",
      status: "active",
      endsAt: null,
    });
  });

  it("is Free with no status when there's no subscription", () => {
    expect(planState("Free", null, { withDates: true }).status).toBeNull();
  });

  it("reads a cancelled-at-period-end plan as ending, dated only for billing roles", () => {
    const cancelling = { ...pro, cancelAtPeriodEnd: true };
    expect(planState("Pro", cancelling, { withDates: true })).toMatchObject({
      status: "non_renewing",
      endsAt: "2027-03-12T00:00:00.000Z",
    });
    expect(
      planState("Pro", cancelling, { withDates: false }).endsAt
    ).toBeNull();
  });
});

describe("seatUsage", () => {
  it("counts pending invitations against the limit", () => {
    expect(seatUsage(2, 1, 3)).toEqual({
      used: 3,
      max: 3,
      full: true,
      pct: 100,
    });
  });

  it("is not full below the limit", () => {
    expect(seatUsage(2, 0, 3)).toMatchObject({ full: false, pct: 67 });
  });

  it("stays full and capped past the limit (a downgrade)", () => {
    expect(seatUsage(5, 0, 3)).toMatchObject({ full: true, pct: 100 });
  });
});

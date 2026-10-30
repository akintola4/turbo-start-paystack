import { describe, expect, it } from "vitest";

import {
  actionLabel,
  planChangeSuccess,
  planConfirm,
} from "../src/lib/plan-change-copy";
import type { PlanOption } from "../src/lib/view-models";

const proYearly: PlanOption = {
  key: "pro",
  name: "Pro",
  description: "",
  features: [],
  trialDays: 14,
  memberLimit: 50,
  rank: 2,
  price: {
    id: "pro-annually-ngn",
    label: "₦300,000.00",
    amountSubunit: 30_000_000,
    interval: "annually",
  },
  saving: "Save 17%",
  isCurrent: false,
  action: "change-plan",
  // Monthly to yearly on the same plan: what planChangeKind says.
  change: "upgrade",
  chargeNow: { subunit: 0, label: "₦0.00" },
  intervalOnly: true,
};

const sub = {
  planName: "Pro",
  status: "active" as const,
  currentPeriodEnd: "2026-11-13T10:00:00.000Z",
  trialEndsAt: null,
};

describe("plan change copy follows the server's rule", () => {
  it("monthly to yearly in a trial: applies now, nothing charged, no 'keeps until'", () => {
    const trial = {
      ...sub,
      status: "trialing" as const,
      trialEndsAt: "2026-11-13T10:00:00.000Z",
    };
    const confirm = planConfirm(proYearly, trial, "Kola Logistics");
    expect(confirm?.title).toBe("Switch to yearly billing?");
    expect(confirm?.description).toBe(
      "Kola Logistics moves to yearly billing now. You're still in the trial, so nothing is charged today; ₦300,000.00 per year from 13 Nov 2026."
    );
    expect(confirm?.description).not.toMatch(/keeps/);
    expect(planChangeSuccess(proYearly, trial, "Kola Logistics")).toBe(
      "Kola Logistics is now on yearly billing"
    );
    expect(actionLabel(proYearly)).toBe("Switch to yearly billing");
  });

  it("monthly to yearly when paid: applies now and quotes the server's charge", () => {
    const owed = {
      ...proYearly,
      chargeNow: { subunit: 1_234_500, label: "₦12,345.00" },
    };
    expect(planConfirm(owed, sub, "Kola Logistics")?.description).toBe(
      "Kola Logistics moves to yearly billing now. Today we charge ₦12,345.00 to the card on file for the rest of this period, then ₦300,000.00 per year from 13 Nov 2026."
    );
    // Yearly is cheaper per day, so usually nothing is owed.
    expect(planConfirm(proYearly, sub, "Kola Logistics")?.description).toBe(
      "Kola Logistics moves to yearly billing now. Nothing is charged today; ₦300,000.00 per year from 13 Nov 2026."
    );
    expect(planChangeSuccess(owed, sub, "Kola Logistics")).not.toMatch(
      /starts on/
    );
  });

  it("yearly to monthly waits for the period end", () => {
    const monthly: PlanOption = {
      ...proYearly,
      price: {
        id: "pro-monthly-ngn",
        label: "₦30,000.00",
        amountSubunit: 3_000_000,
        interval: "monthly",
      },
      change: "downgrade",
      chargeNow: null,
    };
    const confirm = planConfirm(monthly, sub, "Kola Logistics");
    expect(confirm?.title).toBe("Switch to monthly billing?");
    expect(confirm?.description).toContain("until 13 Nov 2026");
    expect(confirm?.description).toContain("Nothing is charged today.");
    expect(planChangeSuccess(monthly, sub, "Kola Logistics")).toBe(
      "Monthly billing starts on 13 Nov 2026"
    );
  });
});

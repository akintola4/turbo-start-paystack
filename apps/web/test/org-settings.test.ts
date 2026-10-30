import { slugProblem } from "@workspace/auth/org-rules";
import { describe, expect, it } from "vitest";

import type { DeleteBlock } from "../src/lib/org-settings";

import {
  deleteBlock,
  deleteBlockMessage,
  slugInput,
} from "../src/lib/org-settings";

describe("slugs", () => {
  it("typing keeps a trailing hyphen so the next word can follow", () => {
    expect(slugInput("Kola-")).toBe("kola-");
    expect(slugInput("Kola  NG!")).toBe("kola-ng-");
    expect(slugInput("--kola")).toBe("kola");
  });

  it("accepts lowercase words joined by single hyphens", () => {
    expect(slugProblem("kola-logistics")).toBeNull();
    expect(slugProblem("k9")).toMatch(/at least 3/);
    expect(slugProblem("kola-")).toMatch(/hyphen/);
    expect(slugProblem("Kola")).toMatch(/lowercase/);
    expect(slugProblem("a".repeat(49))).toMatch(/at most 48/);
  });
});

describe("deleting an organization with a plan", () => {
  const base = {
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2028-02-12T21:03:00.000Z",
    graceUntil: null,
  };

  it("a renewing paid plan blocks it, with the date access ends", () => {
    const block = deleteBlock({ ...base, status: "active" });
    expect(block).toEqual({
      reason: "active",
      accessEndsAt: "2028-02-12T21:03:00.000Z",
    });
    expect(deleteBlockMessage(block as DeleteBlock)).toBe(
      "This organization has a paid plan that renews. Cancel it in Billing first; you keep access until 12 Feb 2028, then come back to delete."
    );
  });

  it("a past-due plan blocks it until the grace deadline is dealt with", () => {
    const block = deleteBlock({
      ...base,
      status: "past_due",
      graceUntil: "2028-01-19T21:03:00.000Z",
    });
    expect(block?.reason).toBe("past_due");
    expect(deleteBlockMessage(block as DeleteBlock)).toMatch(
      /access ends on 19 Jan 2028/
    );
  });

  it("a cancelled, ending, trialing or missing plan doesn't block it", () => {
    expect(deleteBlock(null)).toBeNull();
    expect(
      deleteBlock({ ...base, status: "active", cancelAtPeriodEnd: true })
    ).toBeNull();
    for (const status of ["non_renewing", "trialing", "canceled", "expired"]) {
      expect(deleteBlock({ ...base, status })).toBeNull();
    }
  });
});

import { describe, expect, it } from "vitest";

import { refundState } from "../src/refund-state";

const state = (events: string[], requested = true) =>
  refundState({ requested, events });

describe("refundState", () => {
  it("is pending once Paystack accepts the request, before any event", () => {
    expect(state([])).toBe("pending");
  });

  it("stays pending through pending and processing", () => {
    expect(state(["refund.pending"])).toBe("pending");
    expect(state(["refund.pending", "refund.processing"])).toBe("pending");
  });

  it("goes pending → processed", () => {
    expect(state(["refund.pending", "refund.processed"])).toBe("processed");
  });

  it("goes pending → failed and pending → needs attention", () => {
    expect(state(["refund.pending", "refund.failed"])).toBe("failed");
    expect(state(["refund.pending", "refund.needs-attention"])).toBe(
      "needs_attention"
    );
  });

  it("keeps processed when pending arrives after it", () => {
    expect(state(["refund.processed", "refund.pending"])).toBe("processed");
    expect(state(["refund.processed", "refund.processing"])).toBe("processed");
  });

  it("lets processed win over failed in either order", () => {
    expect(state(["refund.failed", "refund.processed"])).toBe("processed");
    expect(state(["refund.processed", "refund.failed"])).toBe("processed");
  });

  it("ignores a redelivered event", () => {
    expect(state(["refund.processed", "refund.processed"])).toBe("processed");
    expect(state(["refund.pending", "refund.pending"])).toBe("pending");
  });

  it("counts events even when our request wasn't recorded", () => {
    expect(state(["refund.pending"], false)).toBe("pending");
    expect(state(["refund.processed"], false)).toBe("processed");
  });

  it("is failed when Paystack never accepted the request", () => {
    expect(state([], false)).toBe("failed");
  });
});

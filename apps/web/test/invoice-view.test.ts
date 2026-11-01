import type { InvoiceDocument } from "@workspace/billing";
import { describe, expect, it } from "vitest";

import { invoiceView } from "../src/lib/invoice-view";

function doc(overrides: Partial<InvoiceDocument> = {}): InvoiceDocument {
  return {
    id: "inv_1",
    number: "INV-2026-000001",
    title: "Invoice",
    status: "paid",
    kind: "renewal",
    currency: "NGN",
    seller: { name: "Turbo Start Ltd" },
    buyer: { name: "Kola Logistics" },
    issuedAt: "2026-11-12T09:00:00.000Z",
    paidAt: "2026-11-12T09:00:00.000Z",
    refund: null,
    refundedAt: null,
    periodStart: "2026-11-12T00:00:00.000Z",
    periodEnd: "2026-12-12T00:00:00.000Z",
    lines: [
      { description: "Pro plan", detail: null, amountSubunit: 3_000_000 },
    ],
    totals: {
      netSubunit: 3_000_000,
      taxSubunit: 0,
      taxRateBp: 0,
      totalSubunit: 3_000_000,
      refundedSubunit: 0,
      paidSubunit: 3_000_000,
    },
    payment: { brand: "visa", last4: "4242" },
    reference: "ref_123",
    paystackInvoiceCode: null,
    ...overrides,
  };
}

const paidWith = (view: ReturnType<typeof invoiceView>) =>
  view.meta.find((m) => m.label === "Paid with")?.value;

describe("invoiceView", () => {
  it("names the card only when money was taken", () => {
    expect(paidWith(invoiceView(doc()))).toBe("Visa ending 4242");
    expect(paidWith(invoiceView(doc({ status: "refunded" })))).toBe(
      "Visa ending 4242"
    );
    expect(paidWith(invoiceView(doc({ status: "failed" })))).toBeUndefined();
    expect(paidWith(invoiceView(doc({ status: "pending" })))).toBeUndefined();
  });

  it("says 'paid by card' in the footer only for charged documents", () => {
    expect(invoiceView(doc()).referenceNote).toMatch(/^Paid by card/);
    const failed = invoiceView(doc({ status: "failed" })).referenceNote;
    expect(failed).not.toMatch(/paid/i);
    expect(failed).toMatch(/Quote the reference/);
  });

  it("writes the period with the year once", () => {
    const period = invoiceView(doc()).meta.find((m) => m.label === "Period");
    expect(period?.value).toBe("12 Nov – 12 Dec 2026");
  });

  it("marks the seller with its initials, skipping the legal suffix", () => {
    expect(invoiceView(doc()).mark).toBe("TS");
  });
});

describe("invoiceView for a refund", () => {
  const returned = (state: string) =>
    state === "processed" || state === "pending";
  const refundDoc = (
    state: NonNullable<InvoiceDocument["refund"]>["state"],
    refundedAt: string | null = null
  ) =>
    doc({
      number: null,
      title: "Card check",
      status: "refunded",
      kind: "card_check",
      periodStart: null,
      periodEnd: null,
      refund: { state, requestedAt: "2026-11-01T16:08:00.000Z" },
      refundedAt,
      totals: {
        netSubunit: 5000,
        taxSubunit: 0,
        taxRateBp: 0,
        totalSubunit: 5000,
        refundedSubunit: returned(state) ? 5000 : 0,
        paidSubunit: returned(state) ? 0 : 5000,
      },
    });
  const totals = (view: ReturnType<typeof invoiceView>) =>
    view.totals.map((t) => t.label);

  it("says pending, not refunded, until Paystack processes it", () => {
    const view = invoiceView(refundDoc("pending"));
    expect(view.badge).toBe("refund_pending");
    expect(view.statusLabel).toBe("Refund pending");
    expect(view.struck).toBe(false);
    expect(view.caption).toBe(
      "Refund requested on 1 November 2026. Paystack is processing it."
    );
    expect(totals(view)).toEqual([
      "Charged",
      "Refund pending",
      "Total after refund",
    ]);
  });

  it("says refunded, with the date and the bank delay, once processed", () => {
    const view = invoiceView(
      refundDoc("processed", "2026-11-02T09:00:00.000Z")
    );
    expect(view.statusLabel).toBe("Refunded");
    expect(view.struck).toBe(true);
    expect(view.caption).toBe(
      "Refunded on 2 November 2026. Banks can take up to 10 business days to show it."
    );
    expect(totals(view)).toEqual([
      "Charged",
      "Refunded 2 Nov 2026",
      "Total paid",
    ]);
  });

  it.each([
    ["failed", "Refund failed"],
    ["needs_attention", "Refund delayed"],
  ] as const)("says a %s refund didn't reach the card", (state, label) => {
    const view = invoiceView(refundDoc(state));
    expect(view.statusLabel).toBe(label);
    expect(view.struck).toBe(false);
    expect(view.caption).toMatch(/hasn't reached you yet/);
    expect(view.caption).toMatch(/Contact support/);
    expect(totals(view)).toEqual(["Total paid"]);
    expect(view.totals[0]?.value).toBe(view.amount);
  });
});

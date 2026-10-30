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

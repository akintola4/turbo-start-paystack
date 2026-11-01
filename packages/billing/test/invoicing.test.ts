import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { invoiceEvent } from "../src/fixtures";
import { buildInvoiceDocument, invoiceFilename } from "../src/invoice-document";
import {
  formatInvoiceNumber,
  type InvoicingConfig,
  parseTaxRate,
  splitInclusiveTax,
} from "../src/invoicing";
import { type BillingHarness, setupBilling } from "./support";

const SELLER = {
  name: "Turbo Start Ltd",
  address: "12 Admiralty Way\nLekki, Lagos",
  email: "billing@turbo.test",
  taxId: "RC 1234567",
  vatNumber: "VAT-0001",
};
const config: InvoicingConfig = { seller: SELLER, taxRateBp: 750 };
const fail = (): never => {
  throw new Error("no invoice row");
};

describe("tax maths (integer subunits)", () => {
  it("parses percentages to basis points", () => {
    expect(parseTaxRate(undefined)).toBe(0);
    expect(parseTaxRate("")).toBe(0);
    expect(parseTaxRate("7.5")).toBe(750);
    expect(parseTaxRate("16")).toBe(1600);
    expect(parseTaxRate("0.05")).toBe(5);
    expect(parseTaxRate("100")).toBe(10_000);
    expect(() => parseTaxRate("7,5")).toThrow(/Invalid tax rate/);
    expect(() => parseTaxRate("101")).toThrow(/Invalid tax rate/);
    expect(() => parseTaxRate("7.555")).toThrow(/Invalid tax rate/);
  });

  it.each([
    // total, rate → net + tax (net rounded half-up; tax is the remainder)
    [1_000_000, 750, 930_233, 69_767], // ₦10,000 incl. 7.5% VAT
    [3_000_000, 750, 2_790_698, 209_302],
    [107_500, 750, 100_000, 7_500], // exact
    [1, 750, 1, 0],
    [3, 1600, 3, 0], // 2.586 → 3
    [7, 1600, 6, 1], // 6.034 → 6
    [1_000_000, 0, 1_000_000, 0],
    [-1_000_000, 750, -930_233, -69_767],
  ])("%i at %i bp → net %i + tax %i", (total, rate, net, tax) => {
    const split = splitInclusiveTax(total, rate);
    expect(split).toEqual({ netSubunit: net, taxSubunit: tax });
    expect(split.netSubunit + split.taxSubunit).toBe(total);
  });

  it("stays exact for very large amounts", () => {
    const total = 9_000_000_000_000; // ₦90bn in kobo
    const { netSubunit, taxSubunit } = splitInclusiveTax(total, 750);
    expect(netSubunit + taxSubunit).toBe(total);
    expect(Number.isSafeInteger(netSubunit)).toBe(true);
  });

  it("rejects fractional subunits", () => {
    expect(() => splitInclusiveTax(10.5, 750)).toThrow();
  });

  it("formats invoice numbers", () => {
    expect(formatInvoiceNumber(2026, 123)).toBe("INV-2026-000123");
  });
});

describe("issuing invoices", () => {
  let h: BillingHarness;
  beforeAll(async () => {
    h = await setupBilling({ invoicing: config });
  });
  afterAll(async () => h.close());

  const rowsOf = (organizationId: string) =>
    h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.organizationId, organizationId));

  const seq = (n: string | null) => Number(n?.slice(-6));

  it("numbers each paid invoice once, in sequence, with the tax frozen", async () => {
    const a = await h.subscribe();
    const b = await h.subscribe();
    const [ia] = await rowsOf(a.organizationId);
    const [ib] = await rowsOf(b.organizationId);
    expect(ia?.number).toMatch(/^INV-2026-\d{6}$/);
    expect(seq(ib?.number ?? null)).toBe(seq(ia?.number ?? null) + 1);
    expect(ia).toMatchObject({
      kind: "subscription",
      planPriceId: "pro-monthly-ngn",
      taxRateBp: 750,
      netSubunit: 2_790_698,
      taxSubunit: 209_302,
      seller: SELLER,
      buyer: { name: "Org 1", email: "owner1@acme.test" },
    });
    expect(ia?.issuedAt).toEqual(ia?.paidAt);

    // Replaying the same charge does not issue it again.
    await h.deliver({ ...a.paid.charge, replay: 1 });
    const [again] = await rowsOf(a.organizationId);
    expect(again?.number).toBe(ia?.number);
  });

  it("does not number a failed attempt until it is paid", async () => {
    const s = await h.subscribe();
    const code = s.sub.paystackSubscriptionCode ?? "";
    const base = {
      invoiceCode: "INV_numbering_fail",
      subscriptionCode: code,
      amount: 3_000_000,
      customer: s.paid.customer,
      periodStart: "2026-04-01T10:00:00.000Z",
      periodEnd: "2026-05-01T10:00:00.000Z",
    };
    await h.deliver(
      invoiceEvent({
        ...base,
        event: "invoice.payment_failed",
        status: "failed",
        paid: false,
      })
    );
    const failed = (await rowsOf(s.organizationId)).find(
      (r) => r.paystackInvoiceCode === base.invoiceCode
    );
    expect(failed?.number).toBeNull();
    await h.deliver(
      invoiceEvent({
        ...base,
        event: "invoice.update",
        status: "success",
        paid: true,
        reference: "T_numbering_fail",
        paidAt: "2026-04-01T10:00:00.000Z",
      })
    );
    const paid = (await rowsOf(s.organizationId)).find(
      (r) => r.paystackInvoiceCode === base.invoiceCode
    );
    expect(paid?.number).toMatch(/^INV-2026-/);
  });

  it("keeps the issued buyer when billing details change later", async () => {
    const s = await h.subscribe();
    const [before] = await rowsOf(s.organizationId);
    expect(before?.buyer).toMatchObject({ name: "Org 4" });

    await h.billing.updateBillingDetails({
      organizationId: s.organizationId,
      actor: s.actor,
      details: {
        legalName: "  Kola Logistics Limited ",
        address: "3 Marina\r\nLagos  ",
        taxId: "TIN 12345678-0001",
        email: "Accounts@Kola.test",
      },
    });
    const [after] = await rowsOf(s.organizationId);
    expect(after?.buyer).toEqual(before?.buyer);
    expect(after?.seller).toEqual(before?.seller);

    // The next invoice is issued to the new details.
    const remote = h.fake.subscriptions.get(
      s.sub.paystackSubscriptionCode ?? ""
    );
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    await h.deliver({
      ...s.paid.charge,
      data: {
        ...s.paid.charge.data,
        reference: "T_after_edit",
        metadata: "",
        paid_at: "2026-04-01T10:00:00.000Z",
      },
    });
    const renewal = (await rowsOf(s.organizationId)).find(
      (r) => r.reference === "T_after_edit"
    );
    expect(renewal?.buyer).toEqual({
      name: "Kola Logistics Limited",
      address: "3 Marina\nLagos",
      taxId: "TIN 12345678-0001",
      email: "accounts@kola.test",
    });
    expect(renewal?.kind).toBe("renewal");
  });

  it("never numbers the trial's card check", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    await h.deliver(paid.charge);
    const [row] = await rowsOf(org.organizationId);
    expect(row).toMatchObject({
      kind: "card_check",
      status: "void",
      number: null,
    });
    expect(row).toMatchObject({ refundStatus: "pending", refundedAt: null });
    expect(row?.refundRequestedAt).not.toBeNull();
    expect(await h.billing.listInvoices(org.organizationId)).toHaveLength(0);
    expect(await h.billing.listCardChecks(org.organizationId)).toHaveLength(1);
  });

  it("freezes Billed to on a refunded card check, so a receipt never changes", async () => {
    const org = await h.createOrg();
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    await h.deliver(h.pay(checkout.reference).charge);
    const [row] = await rowsOf(org.organizationId);
    expect(row?.number).toBeNull();
    expect(row?.buyer).toMatchObject({ name: expect.stringMatching(/^Org /) });
    const before = buildInvoiceDocument(row ?? fail(), {
      config,
      buyer: { name: "unused" },
    });

    await h.billing.updateBillingDetails({
      organizationId: org.organizationId,
      actor: org.actor,
      details: {
        legalName: "Renamed Ltd",
        address: "1 New Road",
        taxId: "TIN 1",
        email: "new@kola.test",
      },
    });
    const [after] = await rowsOf(org.organizationId);
    expect(after?.buyer).toEqual(row?.buyer);
    // Rendered from the snapshot, not from what the page passes as current.
    const doc = buildInvoiceDocument(after ?? fail(), {
      config: { seller: { name: "Someone Else" }, taxRateBp: 0 },
      buyer: { name: "Renamed Ltd", email: "new@kola.test" },
    });
    expect(doc.buyer).toEqual(before.buyer);
    expect(doc.seller).toEqual(before.seller);
    expect(doc.totals.taxRateBp).toBe(0);
  });

  it("finds an invoice only through its own organization", async () => {
    const a = await h.subscribe();
    const b = await h.subscribe();
    const [row] = await rowsOf(a.organizationId);
    expect(
      await h.billing.getInvoice(a.organizationId, row?.id ?? "")
    ).not.toBeNull();
    expect(
      await h.billing.getInvoice(b.organizationId, row?.id ?? "")
    ).toBeNull();
  });

  it("builds the same document from the snapshot after settings change", async () => {
    const s = await h.subscribe();
    const [row] = await rowsOf(s.organizationId);
    if (!row) {
      throw new Error("no invoice");
    }
    const doc = buildInvoiceDocument(row, {
      config: { seller: { name: "Someone Else" }, taxRateBp: 0 },
      buyer: { name: "Renamed Org" },
    });
    expect(doc).toMatchObject({
      title: "Invoice",
      status: "paid",
      seller: SELLER,
      buyer: { name: `Org ${s.organizationId.slice(4)}` },
      totals: {
        netSubunit: 2_790_698,
        taxSubunit: 209_302,
        taxRateBp: 750,
        totalSubunit: 3_000_000,
        refundedSubunit: 0,
        paidSubunit: 3_000_000,
      },
    });
    expect(doc.lines).toEqual([
      expect.objectContaining({
        description: "Pro plan",
        amountSubunit: 2_790_698,
      }),
    ]);
    expect(doc.lines[0]?.detail).toMatch(/^Monthly · 1 Mar – 1 Apr 2026$/);
    expect(invoiceFilename(doc, "Kola Logistics!")).toBe(
      `${row.number}-kola-logistics.pdf`
    );
  });
});

describe("invoice document for a refunded charge", () => {
  const voidRow = (
    refund: Partial<typeof schema.invoice.$inferSelect> = {}
  ): typeof schema.invoice.$inferSelect => ({
    id: "11111111-2222",
    organizationId: "org",
    subscriptionId: null,
    paystackInvoiceCode: null,
    reference: "tsp_abc",
    amountSubunit: 5000,
    currency: "NGN",
    status: "void",
    periodStart: null,
    periodEnd: null,
    paidAt: new Date("2026-10-29T10:00:00Z"),
    description: "Card verification (refunded)",
    kind: "card_check",
    planPriceId: "starter-monthly-ngn",
    cardBrand: "visa",
    cardLast4: "4081",
    refundRequestedAt: new Date("2026-10-29T10:00:01Z"),
    refundStatus: "processed",
    refundedAt: new Date("2026-10-29T12:00:00Z"),
    number: null,
    issuedAt: null,
    seller: null,
    buyer: null,
    taxRateBp: null,
    netSubunit: null,
    taxSubunit: null,
    raw: null,
    createdAt: new Date("2026-10-29T10:00:00Z"),
    updatedAt: new Date("2026-10-29T10:00:00Z"),
    ...refund,
  });

  it("shows the charge, the refund and nothing paid, without tax", () => {
    const doc = buildInvoiceDocument(voidRow(), {
      config,
      buyer: { name: "Kola" },
    });
    expect(doc.title).toBe("Card check");
    expect(doc.status).toBe("refunded");
    expect(doc.refund).toEqual({
      state: "processed",
      requestedAt: "2026-10-29T10:00:01.000Z",
    });
    expect(doc.refundedAt).toBe("2026-10-29T12:00:00.000Z");
    expect(doc.lines.map((l) => l.amountSubunit)).toEqual([5000]);
    expect(doc.totals).toMatchObject({
      taxRateBp: 0,
      taxSubunit: 0,
      refundedSubunit: 5000,
      paidSubunit: 0,
    });
    expect(invoiceFilename(doc, "kola")).toBe("receipt-11111111-kola.pdf");
  });

  it("carries a pending refund without a refund date", () => {
    const doc = buildInvoiceDocument(
      voidRow({ refundStatus: "pending", refundedAt: null }),
      { config, buyer: { name: "Kola" } }
    );
    expect(doc.refund?.state).toBe("pending");
    expect(doc.refundedAt).toBeNull();
  });

  it("counts a failed refund as paid: the money never went back", () => {
    const doc = buildInvoiceDocument(
      voidRow({ refundStatus: "failed", refundedAt: null, kind: "proration" }),
      { config, buyer: { name: "Kola" } }
    );
    expect(doc.refund?.state).toBe("failed");
    expect(doc.title).toBe("Refund");
    expect(doc.totals).toMatchObject({ refundedSubunit: 0, paidSubunit: 5000 });
  });
});

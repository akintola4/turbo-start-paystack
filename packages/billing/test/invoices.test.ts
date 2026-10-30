import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { invoiceEvent } from "../src/fixtures";
import { type BillingHarness, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

const invoicesOf = (organizationId: string) =>
  h.db
    .select()
    .from(schema.invoice)
    .where(eq(schema.invoice.organizationId, organizationId));

/** A subscribed org plus the payloads of one renewal on its due date:
 *  `charge.success`, `invoice.update` (paid) and, optionally, the failed
 *  attempt before it. The invoice event's `paid_at` is deliberately a
 *  different instant from the charge's, the way a webhook can disagree. */
async function renewalFixture(n: number) {
  const s = await h.subscribe();
  const code = s.sub.paystackSubscriptionCode ?? "";
  const due = new Date(s.sub.currentPeriodEnd ?? 0);
  const periodEnd = new Date(due);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const reference = `T_renewal_${n}`;
  const invoiceCode = `INV_renewal_${n}`;
  const remote = h.fake.subscriptions.get(code);
  if (remote) {
    remote.next_payment_date = periodEnd.toISOString();
  }
  const base = {
    invoiceCode,
    subscriptionCode: code,
    amount: 3_000_000,
    customer: s.paid.customer,
    periodStart: due.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
  const failed = invoiceEvent({
    ...base,
    event: "invoice.payment_failed",
    status: "failed",
    paid: false,
  });
  const invoicePaid = invoiceEvent({
    ...base,
    event: "invoice.update",
    status: "success",
    paid: true,
    reference,
    paidAt: "2030-01-01T00:00:00.000Z",
  });
  const charge = {
    ...s.paid.charge,
    data: {
      ...s.paid.charge.data,
      reference,
      metadata: "",
      paid_at: due.toISOString(),
    },
  };
  return {
    ...s,
    due,
    periodEnd,
    reference,
    invoiceCode,
    failed,
    invoicePaid,
    charge,
  };
}

describe("one invoice per Paystack payment, in any event order", () => {
  for (const order of ["charge first", "invoice first"] as const) {
    it(`renewal, ${order}: one row, the charge's paid date, labelled`, async () => {
      const r = await renewalFixture(order === "charge first" ? 1 : 2);
      const events =
        order === "charge first"
          ? [r.charge, r.invoicePaid]
          : [r.invoicePaid, r.charge];
      for (const event of events) {
        await h.deliver(event);
      }
      const rows = (await invoicesOf(r.organizationId)).filter(
        (i) =>
          i.reference === r.reference || i.paystackInvoiceCode === r.invoiceCode
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "paid",
        reference: r.reference,
        paystackInvoiceCode: r.invoiceCode,
        description: "Renewal",
        paidAt: r.due,
        periodStart: r.due,
        periodEnd: r.periodEnd,
      });
    });

    it(`recovery after a failed attempt, ${order}: the failed row becomes the paid one`, async () => {
      const r = await renewalFixture(order === "charge first" ? 3 : 4);
      await h.deliver(r.failed);
      const events =
        order === "charge first"
          ? [r.charge, r.invoicePaid]
          : [r.invoicePaid, r.charge];
      for (const event of events) {
        await h.deliver(event);
      }
      const rows = (await invoicesOf(r.organizationId)).filter(
        (i) =>
          i.reference === r.reference || i.paystackInvoiceCode === r.invoiceCode
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "paid",
        reference: r.reference,
        paystackInvoiceCode: r.invoiceCode,
        description: "Renewal",
        paidAt: r.due,
      });
    });
  }

  it("replaying every event again changes nothing", async () => {
    const r = await renewalFixture(5);
    for (const event of [r.failed, r.charge, r.invoicePaid]) {
      await h.deliver(event);
    }
    const before = await invoicesOf(r.organizationId);
    for (const event of [r.invoicePaid, r.charge, r.failed]) {
      await h.deliver({ ...event, replay: true });
    }
    const after = await invoicesOf(r.organizationId);
    expect(after).toHaveLength(before.length);
    expect(after.map((i) => [i.id, i.status, i.paidAt])).toEqual(
      before.map((i) => [i.id, i.status, i.paidAt])
    );
  });
});

describe("listInvoices", () => {
  it("lists newest first by the date the row shows, with a stable tiebreak", async () => {
    const { organizationId } = await h.createOrg();
    const at = (iso: string) => new Date(iso);
    const row = (
      id: string,
      createdAt: string,
      paidAt: string | null,
      periodStart: string | null = null
    ) => ({
      id,
      organizationId,
      subscriptionId: null,
      amountSubunit: 1_000_000,
      currency: "NGN",
      status: paidAt ? ("paid" as const) : ("failed" as const),
      createdAt: at(createdAt),
      paidAt: paidAt ? at(paidAt) : null,
      periodStart: periodStart ? at(periodStart) : null,
    });
    await h.db.insert(schema.invoice).values([
      // Inserted first (a failed attempt), paid last.
      row("inv-b", "2026-01-01T00:00:00Z", "2026-04-12T00:00:00Z"),
      row("inv-c", "2026-02-01T00:00:00Z", "2026-02-12T00:00:00Z"),
      row("inv-a", "2026-03-01T00:00:00Z", "2026-03-12T00:00:00Z"),
      // Same paid instant as inv-a: the id breaks the tie.
      row("inv-d", "2026-03-02T00:00:00Z", "2026-03-12T00:00:00Z"),
      // Never paid: dated by its period.
      row("inv-e", "2026-05-20T00:00:00Z", null, "2026-03-20T00:00:00Z"),
    ]);
    const list = await h.billing.listInvoices(organizationId);
    expect(list.map((i) => i.id)).toEqual([
      "inv-b",
      "inv-e",
      "inv-d",
      "inv-a",
      "inv-c",
    ]);
  });
});

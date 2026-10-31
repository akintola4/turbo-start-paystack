import { schema } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { refundEvent } from "../src/fixtures";
import { type BillingHarness, setupBilling } from "./support";

/*
 * Refund webhooks (https://paystack.com/docs/payments/refunds/). The trial
 * card check is refunded as soon as it lands, so it is the refund under test:
 * its row is void with `refunded_at` set from the moment Paystack accepted
 * `POST /refund`.
 */

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

async function refundedCardCheck() {
  const org = await h.createOrg();
  const checkout = await h.billing.startCheckout({
    ...org,
    planPriceId: "starter-monthly-ngn",
  });
  await h.deliver(h.pay(checkout.reference).charge);
  const reference = checkout.reference;
  const row = await invoiceFor(reference);
  expect(row).toMatchObject({ status: "void", kind: "card_check" });
  expect(row?.refundedAt).not.toBeNull();
  return { ...org, reference };
}

async function invoiceFor(reference: string) {
  const [row] = await h.db
    .select()
    .from(schema.invoice)
    .where(eq(schema.invoice.reference, reference));
  return row;
}

const audits = (organizationId: string, action: string) =>
  h.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.organizationId, organizationId),
        eq(schema.auditLog.action, action)
      )
    );

const refundNotices = (organizationId: string) =>
  h.notifications.filter(
    (n) => n.type === "refund_failed" && n.organizationId === organizationId
  );

describe.each(["failed", "needs-attention"] as const)("refund.%s", (status) => {
  it("clears the refund date, audits it and tells billing managers", async () => {
    const { organizationId, reference } = await refundedCardCheck();
    const payload = h.fake.settleRefund(reference, status);
    expect(payload.data.transaction_reference).toBe(reference);

    await h.deliver(payload);

    expect((await invoiceFor(reference))?.refundedAt).toBeNull();
    expect(
      await audits(organizationId, `paystack.refund.${status}`)
    ).toHaveLength(1);
    expect(refundNotices(organizationId)).toEqual([
      expect.objectContaining({
        type: "refund_failed",
        reference,
        refundStatus: status,
        amountSubunit: 5000,
        currency: "NGN",
      }),
    ]);
  });

  it("is idempotent: the same event again changes nothing", async () => {
    const { organizationId, reference } = await refundedCardCheck();
    const payload = h.fake.settleRefund(reference, status);
    await h.deliver(payload);
    await h.deliver(payload);
    await h.deliver({ ...payload, redelivered: true });

    expect((await invoiceFor(reference))?.refundedAt).toBeNull();
    // The notification key is the same each time, so one email goes out.
    const keys = new Set(refundNotices(organizationId).map((n) => n.key));
    expect(keys.size).toBe(1);
  });

  it("loses to refund.processed whichever arrives first", async () => {
    for (const processedFirst of [true, false]) {
      const { organizationId, reference } = await refundedCardCheck();
      const bad = h.fake.settleRefund(reference, status);
      const good = refundEvent({
        status: "processed",
        transactionReference: reference,
        refundReference: bad.data.refund_reference,
        amount: 5000,
        currency: "NGN",
      });
      for (const payload of processedFirst ? [good, bad] : [bad, good]) {
        await h.deliver(payload);
      }
      expect((await invoiceFor(reference))?.refundedAt).not.toBeNull();
      if (processedFirst) {
        expect(refundNotices(organizationId)).toHaveLength(0);
      }
    }
  });
});

describe("refund.processed", () => {
  it("confirms the refund and sends nothing", async () => {
    const { organizationId, reference } = await refundedCardCheck();
    const before = (await invoiceFor(reference))?.refundedAt;
    const payload = h.fake.settleRefund(reference, "processed");
    await h.deliver(payload);
    await h.deliver({ ...payload, redelivered: true });

    expect((await invoiceFor(reference))?.refundedAt).toEqual(before);
    expect(
      await audits(organizationId, "paystack.refund.processed")
    ).toHaveLength(2);
    expect(refundNotices(organizationId)).toHaveLength(0);
  });

  it("sets the refund date on a void row that had none", async () => {
    const { reference } = await refundedCardCheck();
    await h.db
      .update(schema.invoice)
      .set({ refundedAt: null })
      .where(eq(schema.invoice.reference, reference));
    await h.deliver(h.fake.settleRefund(reference, "processed"));
    expect((await invoiceFor(reference))?.refundedAt).not.toBeNull();
  });

  it("pending and processing change nothing", async () => {
    const { reference } = await refundedCardCheck();
    const before = (await invoiceFor(reference))?.refundedAt;
    for (const status of ["pending", "processing"] as const) {
      await h.deliver(
        refundEvent({
          status,
          transactionReference: reference,
          amount: 5000,
          currency: "NGN",
        })
      );
    }
    expect((await invoiceFor(reference))?.refundedAt).toEqual(before);
  });
});

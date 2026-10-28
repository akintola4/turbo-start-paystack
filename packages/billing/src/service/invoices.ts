import { type DbOrTx, schema } from "@workspace/db";
import { eq, or } from "drizzle-orm";

import { newId } from "./context";

type InvoiceStatus = "pending" | "paid" | "failed" | "void";

/**
 * One invoice row per payment, keyed by either the Paystack invoice code
 * (subscription invoices) or the transaction reference (charges). If both
 * arrive in separate events they are merged onto the same row. A paid
 * invoice is never moved back to pending or failed.
 */
export async function upsertInvoice(
  tx: DbOrTx,
  input: {
    organizationId: string;
    subscriptionId: string | null;
    invoiceCode?: string | null;
    reference?: string | null;
    amountSubunit: number;
    currency: string;
    status: InvoiceStatus;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    paidAt?: Date | null;
    description?: string | null;
    raw?: unknown;
  }
) {
  const keys = [
    input.invoiceCode
      ? eq(schema.invoice.paystackInvoiceCode, input.invoiceCode)
      : undefined,
    input.reference ? eq(schema.invoice.reference, input.reference) : undefined,
  ].filter((k) => k !== undefined);
  const [existing] =
    keys.length > 0
      ? await tx
          .select()
          .from(schema.invoice)
          .where(or(...keys))
          .limit(1)
          .for("update")
      : [];

  if (!existing) {
    await tx.insert(schema.invoice).values({
      id: newId(),
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId,
      paystackInvoiceCode: input.invoiceCode ?? null,
      reference: input.reference ?? null,
      amountSubunit: input.amountSubunit,
      currency: input.currency,
      status: input.status,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      paidAt: input.paidAt ?? null,
      description: input.description ?? null,
      raw: input.raw ?? null,
    });
    return;
  }

  const status = existing.status === "paid" ? "paid" : input.status;
  await tx
    .update(schema.invoice)
    .set({
      status,
      paystackInvoiceCode:
        existing.paystackInvoiceCode ?? input.invoiceCode ?? null,
      reference: existing.reference ?? input.reference ?? null,
      subscriptionId: existing.subscriptionId ?? input.subscriptionId,
      periodStart: existing.periodStart ?? input.periodStart ?? null,
      periodEnd: existing.periodEnd ?? input.periodEnd ?? null,
      paidAt: existing.paidAt ?? input.paidAt ?? null,
    })
    .where(eq(schema.invoice.id, existing.id));
}

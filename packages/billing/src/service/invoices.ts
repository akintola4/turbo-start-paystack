import { type DbOrTx, schema } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";

import { DEFAULT_INVOICING, issueInvoice } from "../invoicing";
import { type BillingDeps, newId } from "./context";

type InvoiceStatus = "pending" | "paid" | "failed" | "void";
type InvoiceRow = typeof schema.invoice.$inferSelect;

export type InvoiceInput = {
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
  kind?: "subscription" | "renewal" | "proration" | "card_check" | null;
  planPriceId?: string | null;
  card?: { brand?: string | null; last4?: string | null } | null;
  refundedAt?: Date | null;
  raw?: unknown;
  /**
   * Which Paystack object this write comes from. Each one is the authority
   * for different fields, so the merged row is the same whichever event
   * arrives first: the transaction ("charge", or our own service charging
   * it) owns the paid date and the description; the subscription invoice
   * ("invoice") owns the billing period.
   */
  source: "charge" | "invoice";
};

/** `preferred` wins when set, else the other one. */
const pick = <T>(
  preferred: T | null | undefined,
  other: T | null | undefined
) => preferred ?? other ?? null;

/** Folds a second row for the same payment into `row`. */
function fold(row: InvoiceRow, other: InvoiceRow): InvoiceRow {
  return {
    ...row,
    status: other.status === "paid" ? "paid" : row.status,
    paystackInvoiceCode: pick(
      row.paystackInvoiceCode,
      other.paystackInvoiceCode
    ),
    reference: pick(row.reference, other.reference),
    subscriptionId: pick(row.subscriptionId, other.subscriptionId),
    periodStart: pick(row.periodStart, other.periodStart),
    periodEnd: pick(row.periodEnd, other.periodEnd),
    paidAt: pick(row.paidAt, other.paidAt),
    description: pick(row.description, other.description),
    kind: pick(row.kind, other.kind),
    planPriceId: pick(row.planPriceId, other.planPriceId),
    cardBrand: pick(row.cardBrand, other.cardBrand),
    cardLast4: pick(row.cardLast4, other.cardLast4),
    refundedAt: pick(row.refundedAt, other.refundedAt),
  };
}

/** The stored row with `input` applied, field by field, by authority. */
function applyInput(row: InvoiceRow, input: InvoiceInput) {
  // `owns` fields take the input's value when it has one; the rest only
  // fill a gap.
  const by = <T>(
    owns: boolean,
    incoming: T | null | undefined,
    stored: T | null
  ) => (owns ? pick(incoming, stored) : pick(stored, incoming));
  const charge = input.source === "charge";
  const invoice = input.source === "invoice";
  return {
    status: row.status === "paid" ? ("paid" as const) : input.status,
    paystackInvoiceCode: pick(row.paystackInvoiceCode, input.invoiceCode),
    reference: pick(row.reference, input.reference),
    subscriptionId: pick(row.subscriptionId, input.subscriptionId),
    periodStart: by(invoice, input.periodStart, row.periodStart),
    periodEnd: by(invoice, input.periodEnd, row.periodEnd),
    paidAt: by(charge, input.paidAt, row.paidAt),
    description: by(charge, input.description, row.description),
    kind: by(charge, input.kind, row.kind),
    planPriceId: by(charge, input.planPriceId, row.planPriceId),
    cardBrand: by(
      charge,
      input.card?.last4 ? input.card.brand : null,
      row.cardBrand
    ),
    cardLast4: by(charge, input.card?.last4, row.cardLast4),
    refundedAt: pick(row.refundedAt, input.refundedAt),
  };
}

function findRows(tx: DbOrTx, input: InvoiceInput) {
  const keys = [
    input.invoiceCode
      ? eq(schema.invoice.paystackInvoiceCode, input.invoiceCode)
      : undefined,
    input.reference ? eq(schema.invoice.reference, input.reference) : undefined,
  ].filter((k) => k !== undefined);
  if (keys.length === 0) {
    return Promise.resolve([]);
  }
  return tx
    .select()
    .from(schema.invoice)
    .where(or(...keys))
    .orderBy(schema.invoice.createdAt)
    .for("update");
}

async function insertRow(tx: DbOrTx, input: InvoiceInput) {
  const id = newId();
  const inserted = await tx
    .insert(schema.invoice)
    .values({
      id,
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
      kind: input.kind ?? null,
      planPriceId: input.planPriceId ?? null,
      cardBrand: input.card?.last4 ? (input.card.brand?.trim() ?? null) : null,
      cardLast4: input.card?.last4 ?? null,
      refundedAt: input.refundedAt ?? null,
      raw: input.raw ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.invoice.id });
  return inserted.length > 0 ? id : null;
}

/**
 * One invoice row per payment, keyed by either the Paystack invoice code
 * (subscription invoices) or the transaction reference (charges). Both are
 * unique. A payment can arrive as two rows' worth of keys in either order:
 * a failed attempt stores the invoice code alone, then the recovering
 * `charge.success` stores the reference alone, then `invoice.update` carries
 * both. The two rows are folded into one there. A paid invoice is never
 * moved back to pending or failed. Returns the row id.
 */
export async function upsertInvoice(
  deps: Pick<BillingDeps, "now" | "invoicing">,
  tx: DbOrTx,
  input: InvoiceInput
): Promise<string> {
  const id = await writeInvoice(tx, input);
  // First time it is paid: number it and freeze seller, buyer and tax, in
  // this transaction. A no-op once issued.
  await issueInvoice(tx, deps.invoicing ?? DEFAULT_INVOICING, id, deps.now());
  return id;
}

async function writeInvoice(tx: DbOrTx, input: InvoiceInput): Promise<string> {
  const matches = await findRows(tx, input);
  if (matches.length === 0) {
    // On a lost race for the reference or invoice code, merge instead.
    return (await insertRow(tx, input)) ?? writeInvoice(tx, input);
  }

  // Keep the row that already counts as issued, so a paid row (and later
  // its number) is never deleted; fold the others into it.
  const keeper =
    matches.find((m) => m.status === "paid") ??
    matches.find((m) => m.paystackInvoiceCode !== null) ??
    (matches[0] as InvoiceRow);
  const others = matches.filter((m) => m.id !== keeper.id);
  if (others.length > 0) {
    // Free the unique keys before the keeper takes them over.
    await tx.delete(schema.invoice).where(
      inArray(
        schema.invoice.id,
        others.map((o) => o.id)
      )
    );
  }
  let merged = keeper;
  for (const other of others) {
    merged = fold(merged, other);
  }
  await tx
    .update(schema.invoice)
    .set(applyInput(merged, input))
    .where(eq(schema.invoice.id, keeper.id));
  return keeper.id;
}

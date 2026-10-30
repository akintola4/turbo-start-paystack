import { type DbOrTx, schema } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/** A seller or buyer as printed on an invoice. Every field but the name is
 *  optional and simply left off when empty. */
export type InvoiceParty = {
  name: string;
  /** Multi-line postal address. */
  address?: string | null;
  email?: string | null;
  /** Company or tax registration: RC number, TIN, KRA PIN… */
  taxId?: string | null;
  vatNumber?: string | null;
};

export type InvoicingConfig = {
  seller: InvoiceParty;
  /** Tax included in every price, in basis points (750 = 7.5%). 0 = none. */
  taxRateBp: number;
};

export const DEFAULT_INVOICING: InvoicingConfig = {
  seller: { name: "Turbo Start" },
  taxRateBp: 0,
};

/** "7.5" (percent, as written in env) → 750 basis points. */
export function parseTaxRate(percent: string | undefined): number {
  if (!percent?.trim()) {
    return 0;
  }
  const match = percent.trim().match(/^(\d{1,2}|100)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new Error(
      `Invalid tax rate "${percent}": use a percentage with up to two decimals, e.g. 7.5`
    );
  }
  const bp =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
  if (bp > 10_000) {
    throw new Error(`Invalid tax rate "${percent}": above 100%`);
  }
  return bp;
}

/**
 * Splits a tax-inclusive total (integer subunits) into net and tax. Net is
 * total / (1 + rate) rounded half-up to the subunit; tax is the remainder,
 * so net + tax is always exactly the total charged. BigInt keeps the
 * intermediate product exact for any amount.
 */
export function splitInclusiveTax(
  totalSubunit: number,
  rateBp: number
): { netSubunit: number; taxSubunit: number } {
  if (!(Number.isInteger(totalSubunit) && Number.isInteger(rateBp))) {
    throw new Error("amounts and rates must be integers");
  }
  if (rateBp <= 0) {
    return { netSubunit: totalSubunit, taxSubunit: 0 };
  }
  const sign = totalSubunit < 0 ? -1n : 1n;
  const total = BigInt(Math.abs(totalSubunit));
  const denominator = 10_000n + BigInt(rateBp);
  // round(total * 10000 / denominator), half away from zero.
  const net = (total * 20_000n + denominator) / (2n * denominator);
  return {
    netSubunit: Number(sign * net),
    taxSubunit: Number(sign * (total - net)),
  };
}

export const formatInvoiceNumber = (year: number, n: number) =>
  `INV-${year}-${String(n).padStart(6, "0")}`;

/**
 * The next number in `year`. Must run inside the issuing transaction: the
 * upsert holds the sequence row's lock until commit, so concurrent issuers
 * queue, and a rollback returns the number. No gaps, no duplicates.
 */
export async function nextInvoiceNumber(
  tx: DbOrTx,
  year: number
): Promise<string> {
  const scope = `INV-${year}`;
  const [row] = await tx
    .insert(schema.invoiceSequence)
    .values({ scope, lastValue: 1 })
    .onConflictDoUpdate({
      target: schema.invoiceSequence.scope,
      set: { lastValue: sql`${schema.invoiceSequence.lastValue} + 1` },
    })
    .returning({ lastValue: schema.invoiceSequence.lastValue });
  if (!row) {
    throw new Error("invoice sequence did not return a value");
  }
  return formatInvoiceNumber(year, row.lastValue);
}

const clean = (value: string | null | undefined) => value?.trim() || null;

/** Who the organization's invoices are made out to, today. */
export async function currentBuyer(
  tx: DbOrTx,
  organizationId: string
): Promise<InvoiceParty> {
  const [row] = await tx
    .select({
      orgName: schema.organization.name,
      details: schema.billingDetails,
      customerEmail: schema.billingCustomer.email,
    })
    .from(schema.organization)
    .leftJoin(
      schema.billingDetails,
      eq(schema.billingDetails.organizationId, schema.organization.id)
    )
    .leftJoin(
      schema.billingCustomer,
      eq(schema.billingCustomer.organizationId, schema.organization.id)
    )
    .where(eq(schema.organization.id, organizationId));
  return {
    name: clean(row?.details?.legalName) ?? row?.orgName ?? "",
    address: clean(row?.details?.address),
    taxId: clean(row?.details?.taxId),
    email: clean(row?.details?.email) ?? row?.customerEmail ?? null,
  };
}

/**
 * Gives a paid invoice its number and freezes who it is from and to, and
 * the tax in it. Runs once: an invoice that already has a number is left
 * alone. Card checks are refunded straight away and are never issued.
 *
 * Documents that settle without a number (a refunded card check or charge,
 * a failed payment) still freeze "From" and "Billed to" the first time they
 * settle, so editing billing details later never rewrites a receipt the
 * customer already has. Only a pending row follows the current details.
 */
export async function issueInvoice(
  tx: DbOrTx,
  config: InvoicingConfig,
  invoiceId: string,
  now: Date
): Promise<void> {
  const [row] = await tx
    .select()
    .from(schema.invoice)
    .where(eq(schema.invoice.id, invoiceId))
    .for("update");
  if (!row || row.number !== null || row.status === "pending") {
    return;
  }
  if (row.status !== "paid" || row.kind === "card_check") {
    if (row.buyer === null) {
      await tx
        .update(schema.invoice)
        .set({
          seller: config.seller,
          buyer: await currentBuyer(tx, row.organizationId),
        })
        .where(eq(schema.invoice.id, invoiceId));
    }
    return;
  }
  const issuedAt = row.paidAt ?? now;
  const number = await nextInvoiceNumber(tx, issuedAt.getUTCFullYear());
  const { netSubunit, taxSubunit } = splitInclusiveTax(
    row.amountSubunit,
    config.taxRateBp
  );
  let card = { cardBrand: row.cardBrand, cardLast4: row.cardLast4 };
  if (!card.cardLast4 && row.subscriptionId) {
    const [sub] = await tx
      .select({
        cardBrand: schema.subscription.cardBrand,
        cardLast4: schema.subscription.cardLast4,
      })
      .from(schema.subscription)
      .where(eq(schema.subscription.id, row.subscriptionId));
    card = sub ?? card;
  }
  await tx
    .update(schema.invoice)
    .set({
      number,
      issuedAt,
      seller: config.seller,
      buyer: await currentBuyer(tx, row.organizationId),
      taxRateBp: config.taxRateBp,
      netSubunit,
      taxSubunit,
      ...card,
    })
    .where(eq(schema.invoice.id, invoiceId));
}

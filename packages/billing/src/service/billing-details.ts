import { type DbOrTx, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import type { Actor } from "./checkout";
import { audit } from "./context";

export type BillingDetailsInput = {
  legalName?: string | null;
  address?: string | null;
  taxId?: string | null;
  email?: string | null;
};

const clean = (value: string | null | undefined) => {
  const trimmed = value
    ?.replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
  return trimmed ? trimmed : null;
};

export async function getBillingDetails(db: DbOrTx, organizationId: string) {
  const [row] = await db
    .select()
    .from(schema.billingDetails)
    .where(eq(schema.billingDetails.organizationId, organizationId));
  return row ?? null;
}

/**
 * Saves who future invoices are made out to. Issued invoices keep the copy
 * they were issued with. Blank fields are stored as null (the invoice then
 * falls back to the organization name and the billing email).
 */
export async function updateBillingDetails(
  db: DbOrTx,
  input: { organizationId: string; actor: Actor; details: BillingDetailsInput }
) {
  const values = {
    legalName: clean(input.details.legalName),
    address: clean(input.details.address),
    taxId: clean(input.details.taxId),
    email: clean(input.details.email)?.toLowerCase() ?? null,
    updatedByUserId: input.actor.userId,
  };
  const [row] = await db
    .insert(schema.billingDetails)
    .values({ organizationId: input.organizationId, ...values })
    .onConflictDoUpdate({
      target: schema.billingDetails.organizationId,
      set: values,
    })
    .returning();
  await audit(db, {
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "billing.details_updated",
  });
  return row;
}

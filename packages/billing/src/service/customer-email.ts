import { createHash } from "node:crypto";
import { type Database, type DbOrTx, schema } from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";

import { BillingError } from "../errors";
import { billingCustomer } from "./context";

/**
 * Paystack keys customers by email, and allows one active subscription per
 * customer and plan. So each organization gets its own Paystack customer,
 * which means its own email. The address is picked at the first checkout,
 * stored on `billing_customer.email` and never changed after that:
 *
 * 1. the organization's billing email (Billing details), if no other
 *    organization's Paystack customer uses it;
 * 2. with no billing email set: the email of the person starting the first
 *    checkout, if no other organization's Paystack customer uses it, so the
 *    first organization a person bills keeps their plain address;
 * 3. otherwise that person's email tagged with the organization:
 *    `you+3f9a2c1b@example.com`. The tag comes from the organization id, so
 *    it survives renames, and mail to it still reaches the same inbox.
 *
 * "Uses it" is decided by our `billing_customer` rows, compared lower-case.
 * Whoever stores a row for an address first keeps it; the check is repeated
 * under a lock on the address when the row is stored.
 */

export type CustomerEmailSource = "billing_email" | "personal" | "tagged";

export type CustomerEmailChoice = {
  email: string;
  source: CustomerEmailSource;
};

const MAX_LOCAL = 64;
const MAX_EMAIL = 254;

/** Eight hex characters derived from the organization id. */
export function organizationTag(organizationId: string): string {
  return createHash("sha256").update(organizationId).digest("hex").slice(0, 8);
}

/** `you@example.com` → `you+3f9a2c1b@example.com`, lower-case. Null when
 *  the tagged address would be too long to be a valid email. */
export function taggedEmail(
  email: string,
  organizationId: string
): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0) {
    return null;
  }
  const local = `${email.slice(0, at)}+${organizationTag(organizationId)}`;
  const tagged = `${local}${email.slice(at)}`.toLowerCase();
  return local.length > MAX_LOCAL || tagged.length > MAX_EMAIL ? null : tagged;
}

/** The addresses to try, best first, without duplicates. */
export function customerEmailCandidates(input: {
  organizationId: string;
  billingEmail: string | null | undefined;
  actorEmail: string;
}): CustomerEmailChoice[] {
  const list: CustomerEmailChoice[] = [];
  const add = (
    email: string | null | undefined,
    source: CustomerEmailSource
  ) => {
    const clean = email?.trim().toLowerCase();
    if (clean && !list.some((c) => c.email === clean)) {
      list.push({ email: clean, source });
    }
  };
  add(input.billingEmail, "billing_email");
  // An organization with a billing email asked for an address of its own:
  // if that one is taken, it gets the tagged one, never a person's plain
  // address that their next organization would then have to give up.
  if (!input.billingEmail?.trim()) {
    add(input.actorEmail, "personal");
  }
  add(taggedEmail(input.actorEmail, input.organizationId), "tagged");
  return list;
}

/** Whether another organization's Paystack customer already has `email`. */
export async function emailTakenByAnotherOrg(
  tx: DbOrTx,
  organizationId: string,
  email: string
): Promise<boolean> {
  const [row] = await tx
    .select({ organizationId: schema.billingCustomer.organizationId })
    .from(schema.billingCustomer)
    .where(
      and(
        sql`lower(${schema.billingCustomer.email}) = ${email.toLowerCase()}`,
        ne(schema.billingCustomer.organizationId, organizationId)
      )
    )
    .limit(1);
  return Boolean(row);
}

async function billingEmailOf(tx: DbOrTx, organizationId: string) {
  const [row] = await tx
    .select({ email: schema.billingDetails.email })
    .from(schema.billingDetails)
    .where(eq(schema.billingDetails.organizationId, organizationId));
  return row?.email ?? null;
}

/** The free candidates for an organization that has no customer yet. */
export async function availableCustomerEmails(
  tx: DbOrTx,
  organizationId: string,
  actorEmail: string
): Promise<CustomerEmailChoice[]> {
  const candidates = customerEmailCandidates({
    organizationId,
    billingEmail: await billingEmailOf(tx, organizationId),
    actorEmail,
  });
  const free: CustomerEmailChoice[] = [];
  for (const candidate of candidates) {
    if (!(await emailTakenByAnotherOrg(tx, organizationId, candidate.email))) {
      free.push(candidate);
    }
  }
  return free;
}

export type PaystackEmailView =
  | { locked: true; email: string }
  | ({ locked: false } & CustomerEmailChoice);

/**
 * The address Paystack bills the organization at: the stored one once it
 * has a customer, otherwise the one its first checkout by `actorEmail`
 * would pick.
 */
export async function paystackEmailFor(
  db: Database,
  organizationId: string,
  actorEmail: string
): Promise<PaystackEmailView | null> {
  const existing = await billingCustomer(db, organizationId);
  if (existing) {
    return { locked: true, email: existing.email };
  }
  const [first] = await availableCustomerEmails(db, organizationId, actorEmail);
  return first ? { locked: false, ...first } : null;
}

export function noCustomerEmail(): BillingError {
  return new BillingError(
    "customer_email_unavailable",
    "Set a billing email in Billing details to start a checkout for this organization."
  );
}

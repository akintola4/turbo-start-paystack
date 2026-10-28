import { randomUUID } from "node:crypto";
import { type Database, type DbOrTx, schema } from "@workspace/db";
import type { Logger } from "@workspace/logger";
import { and, eq, notInArray } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "../crypto";
import type { PaystackClient } from "../paystack/client";

export type BillingNotification =
  | { type: "past_due"; organizationId: string; manageLink?: string }
  | { type: "expiring_card"; organizationId: string; manageLink?: string }
  | { type: "trial_started"; organizationId: string; trialEndsAt: Date }
  | { type: "dispute"; organizationId: string; reference: string };

export type BillingDeps = {
  db: Database;
  paystack: PaystackClient;
  /** 64 hex chars; encrypts email tokens and authorization codes at rest. */
  encryptionKey: string;
  /** Where Paystack sends the customer after checkout. */
  callbackUrl: string;
  /** Days a past_due subscription keeps access. */
  graceDays: number;
  /** "card" (default): card-up-front trial on plans with trialDays.
   *  "off": every checkout charges the first period immediately. */
  trialMode?: "card" | "off";
  now: () => Date;
  logger: Pick<Logger, "info" | "warn" | "error">;
  notify?: (notification: BillingNotification) => Promise<void>;
};

export type SubscriptionRow = typeof schema.subscription.$inferSelect;
export type PaymentIntentRow = typeof schema.paymentIntent.$inferSelect;

/** Handler result. `retry` leaves the event unprocessed for reconcile. */
export type Outcome = { error?: string; retry?: boolean };

export const TERMINAL_STATUSES = ["canceled", "expired"] as const;

export const newId = () => randomUUID();
export const newReference = () => `tsp_${randomUUID().replaceAll("-", "")}`;

export function seal(deps: BillingDeps, value: string): string {
  return encryptSecret(value, deps.encryptionKey);
}

export function unseal(deps: BillingDeps, value: string | null): string | null {
  return value ? decryptSecret(value, deps.encryptionKey) : null;
}

export async function audit(
  tx: DbOrTx,
  entry: {
    organizationId: string | null;
    action: string;
    actorUserId?: string | null;
    target?: string | null;
    data?: Record<string, unknown>;
  }
) {
  await tx.insert(schema.auditLog).values({
    id: newId(),
    organizationId: entry.organizationId,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    target: entry.target ?? null,
    data: entry.data ?? null,
  });
}

/** The organization's one non-terminal subscription, optionally row-locked
 *  so concurrent webhooks for the same org serialise. */
export async function liveSubscription(
  tx: DbOrTx,
  organizationId: string,
  options?: { lock?: boolean }
): Promise<SubscriptionRow | null> {
  const query = tx
    .select()
    .from(schema.subscription)
    .where(
      and(
        eq(schema.subscription.organizationId, organizationId),
        notInArray(schema.subscription.status, [...TERMINAL_STATUSES])
      )
    )
    .limit(1);
  const [row] = options?.lock ? await query.for("update") : await query;
  return row ?? null;
}

export async function subscriptionByCode(
  tx: DbOrTx,
  code: string,
  options?: { lock?: boolean }
): Promise<SubscriptionRow | null> {
  const query = tx
    .select()
    .from(schema.subscription)
    .where(eq(schema.subscription.paystackSubscriptionCode, code))
    .limit(1);
  const [row] = options?.lock ? await query.for("update") : await query;
  return row ?? null;
}

export async function planPriceRow(tx: DbOrTx, id: string | null) {
  if (!id) {
    return null;
  }
  const [row] = await tx
    .select()
    .from(schema.planPrice)
    .where(eq(schema.planPrice.id, id));
  return row ?? null;
}

export async function billingCustomer(tx: DbOrTx, organizationId: string) {
  const [row] = await tx
    .select()
    .from(schema.billingCustomer)
    .where(eq(schema.billingCustomer.organizationId, organizationId));
  return row ?? null;
}

export async function isReplacedCode(tx: DbOrTx, code: string) {
  const [row] = await tx
    .select()
    .from(schema.replacedSubscription)
    .where(eq(schema.replacedSubscription.paystackSubscriptionCode, code));
  return row ?? null;
}

/** Card fields to store from a Paystack authorization, only if reusable. */
export function cardFields(
  deps: BillingDeps,
  authorization:
    | {
        authorization_code: string;
        reusable?: boolean;
        signature?: string | null;
        last4?: string | null;
        exp_month?: string | null;
        exp_year?: string | null;
        brand?: string | null;
      }
    | null
    | undefined,
  email: string | undefined
): Partial<SubscriptionRow> {
  if (!authorization?.reusable) {
    return {};
  }
  return {
    authorizationCode: seal(deps, authorization.authorization_code),
    authorizationSignature: authorization.signature ?? null,
    authorizationEmail: email ?? null,
    cardLast4: authorization.last4 ?? null,
    cardBrand: authorization.brand?.trim() ?? null,
    cardExp:
      authorization.exp_month && authorization.exp_year
        ? `${authorization.exp_month}/${authorization.exp_year}`
        : null,
  };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

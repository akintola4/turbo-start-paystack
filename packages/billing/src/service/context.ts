import { randomUUID } from "node:crypto";
import { type Database, type DbOrTx, schema } from "@workspace/db";
import type { Logger } from "@workspace/logger";
import { and, eq, notInArray, sql } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "../crypto";
import type { InvoicingConfig } from "../invoicing";
import type { PaystackClient } from "../paystack/client";

/**
 * Something billing managers should hear about. `key` identifies the event
 * (a payment reference, a subscription plus a date) so the sender can make
 * the email idempotent; it is never shown to anyone.
 */
export type BillingNotification = { organizationId: string; key: string } & (
  | {
      type: "past_due";
      planPriceId: string;
      graceUntil: Date;
      manageLink?: string;
    }
  | { type: "expiring_card"; manageLink?: string }
  | { type: "trial_started"; planPriceId: string; trialEndsAt: Date }
  | {
      type: "trial_ending";
      planPriceId: string;
      trialEndsAt: Date;
      amountSubunit: number;
      currency: string;
    }
  | {
      type: "payment_succeeded";
      planPriceId: string;
      /** The invoice row for this payment, for the receipt's link. */
      invoiceId: string;
      amountSubunit: number;
      currency: string;
      reference: string;
      paidAt: Date;
      periodStart: Date | null;
      periodEnd: Date | null;
    }
  | {
      type: "subscription_canceled";
      planPriceId: string;
      accessUntil: Date | null;
    }
  | {
      type: "plan_changed";
      change: "upgrade" | "downgrade";
      fromPlanPriceId: string;
      toPlanPriceId: string;
      /** Prorated amount charged now; 0 for downgrades and free upgrades. */
      chargedSubunit: number;
      currency: string;
      effectiveAt: Date;
    }
  | { type: "dispute"; reference: string }
  | {
      /** Paystack reported `refund.failed` or `refund.needs-attention`:
       *  the money did not go back to the customer. */
      type: "refund_failed";
      reference: string;
      refundStatus: "failed" | "needs-attention";
      amountSubunit: number | null;
      currency: string | null;
    }
);

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
  /** Seller details and tax for issued invoices. */
  invoicing?: InvoicingConfig;
};

/**
 * Runs `run` in a transaction with a `deps` whose `notify` only queues.
 * The queue is delivered after the commit, so a rolled-back webhook or plan
 * change never emails, and a slow email never holds row locks. Delivery
 * failures are logged, not thrown: the billing state is already committed.
 */
export async function transactionWithNotifications<T>(
  deps: BillingDeps,
  run: (tx: DbOrTx, scoped: BillingDeps) => Promise<T>
): Promise<T> {
  const queued: BillingNotification[] = [];
  const scoped: BillingDeps = {
    ...deps,
    notify: async (notification) => {
      queued.push(notification);
    },
  };
  const result = await deps.db.transaction((tx) => run(tx, scoped));
  for (const notification of queued) {
    try {
      await deps.notify?.(notification);
    } catch (error) {
      deps.logger.error("billing notification failed", {
        type: notification.type,
        organizationId: notification.organizationId,
        error: String(error),
      });
    }
  }
  return result;
}

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
  email: string | null | undefined
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

/**
 * Serialises everything that happens for one Paystack customer within a
 * transaction. Paystack sends `charge.success` and `subscription.create`
 * back to back; processed concurrently, the second would not see the row the
 * first is creating. Transaction-scoped, so it is released on commit.
 */
export async function lockCustomer(
  tx: DbOrTx,
  customerCode: string | undefined
) {
  if (!customerCode) {
    return;
  }
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`paystack:${customerCode}`}))`
  );
}

/** Pulls `customer.customer_code` out of any Paystack event payload. */
export function customerCodeOf(data: unknown): string | undefined {
  if (data && typeof data === "object" && "customer" in data) {
    const customer = (data as { customer?: unknown }).customer;
    if (
      customer &&
      typeof customer === "object" &&
      "customer_code" in customer
    ) {
      const code = (customer as { customer_code?: unknown }).customer_code;
      return typeof code === "string" ? code : undefined;
    }
  }
  return;
}

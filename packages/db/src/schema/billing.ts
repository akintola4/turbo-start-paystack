// Billing tables. Money is integer subunits (kobo, pesewas, cents) plus an
// ISO-4217 currency. Every row belongs to an organization, never a user.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

const tz = { withTimezone: true } as const;
const money = (name: string) => bigint(name, { mode: "number" });
const createdAt = timestamp("created_at", tz).notNull().defaultNow();
const updatedAt = timestamp("updated_at", tz)
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());
const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const subscriptionStatus = pgEnum("subscription_status", [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "non_renewing",
  "canceled",
  "expired",
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "pending",
  "paid",
  "failed",
  "void",
]);

export const paymentIntentKind = pgEnum("payment_intent_kind", [
  "subscribe",
  "trial",
  "upgrade",
  "proration",
]);

export const paymentIntentStatus = pgEnum("payment_intent_status", [
  "created",
  "succeeded",
  "failed",
  "abandoned",
]);

/** One row per (plan × interval × currency). The catalog in code is the
 *  source of truth for amounts; this table holds the Paystack plan code that
 *  `pnpm billing:sync` created for it. */
export const planPrice = pgTable("plan_price", {
  id: text("id").primaryKey(),
  planKey: text("plan_key").notNull(),
  interval: text("interval").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  amountSubunit: money("amount_subunit").notNull(),
  paystackPlanCode: text("paystack_plan_code").unique(),
  active: boolean("active").notNull().default(true),
  createdAt,
  updatedAt,
});

export const billingCustomer = pgTable("billing_customer", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  paystackCustomerCode: text("paystack_customer_code").notNull().unique(),
  email: text("email").notNull(),
  // Locked at first checkout. Changing currency means a new subscription.
  currency: char("currency", { length: 3 }).notNull(),
  createdAt,
});

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    planPriceId: text("plan_price_id")
      .notNull()
      .references(() => planPrice.id),
    status: subscriptionStatus("status").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    paystackSubscriptionCode: text("paystack_subscription_code").unique(),
    // AES-256-GCM ciphertext, see @workspace/billing crypto.ts.
    paystackEmailToken: text("paystack_email_token"),
    authorizationCode: text("authorization_code"),
    authorizationSignature: text("authorization_signature"),
    authorizationEmail: text("authorization_email"),
    cardLast4: text("card_last4"),
    cardBrand: text("card_brand"),
    cardExp: text("card_exp"),
    currentPeriodStart: timestamp("current_period_start", tz),
    currentPeriodEnd: timestamp("current_period_end", tz),
    trialEndsAt: timestamp("trial_ends_at", tz),
    graceUntil: timestamp("grace_until", tz),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", tz),
    endedAt: timestamp("ended_at", tz),
    // Scheduled downgrade: the replacement Paystack subscription already
    // exists (start_date = current_period_end); we swap at period end.
    scheduledPlanPriceId: text("scheduled_plan_price_id").references(
      () => planPrice.id
    ),
    scheduledSubscriptionCode: text("scheduled_subscription_code"),
    scheduledEmailToken: text("scheduled_email_token"),
    createdAt,
    updatedAt,
  },
  (t) => [
    // At most one live subscription per organization.
    uniqueIndex("subscription_one_live_per_org")
      .on(t.organizationId)
      .where(sql`${t.status} not in ('canceled', 'expired')`),
  ]
);

/** Codes of Paystack subscriptions we replaced on purpose (plan changes), so
 *  their later `subscription.disable` webhooks are recognised and ignored. */
export const replacedSubscription = pgTable("replaced_subscription", {
  paystackSubscriptionCode: text("paystack_subscription_code").primaryKey(),
  organizationId: orgId(),
  replacedAt: timestamp("replaced_at", tz).notNull().defaultNow(),
});

export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    subscriptionId: text("subscription_id").references(() => subscription.id),
    paystackInvoiceCode: text("paystack_invoice_code").unique(),
    reference: text("reference").unique(),
    amountSubunit: money("amount_subunit").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    status: invoiceStatus("status").notNull(),
    periodStart: timestamp("period_start", tz),
    periodEnd: timestamp("period_end", tz),
    paidAt: timestamp("paid_at", tz),
    description: text("description"),
    raw: jsonb("raw"),
    createdAt,
    updatedAt,
  },
  (t) => [index("invoice_org_idx").on(t.organizationId)]
);

export const paymentIntent = pgTable(
  "payment_intent",
  {
    // Also the Paystack transaction reference ("tsp_…").
    id: text("id").primaryKey(),
    organizationId: orgId(),
    kind: paymentIntentKind("kind").notNull(),
    planPriceId: text("plan_price_id")
      .notNull()
      .references(() => planPrice.id),
    amountSubunit: money("amount_subunit").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    accessCode: text("access_code"),
    status: paymentIntentStatus("status").notNull().default("created"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (t) => [index("payment_intent_org_idx").on(t.organizationId)]
);

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("paystack"),
    eventType: text("event_type").notNull(),
    // sha256 of the raw body. Paystack retries send the identical body.
    dedupeKey: text("dedupe_key").notNull().unique(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", tz).notNull().defaultNow(),
    processedAt: timestamp("processed_at", tz),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("webhook_event_unprocessed_idx").on(t.processedAt)]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    target: text("target"),
    data: jsonb("data"),
    createdAt,
  },
  (t) => [index("audit_log_org_idx").on(t.organizationId)]
);

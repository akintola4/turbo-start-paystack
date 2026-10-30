import { type DbOrTx, schema } from "@workspace/db";
import { and, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import {
  paystackDate,
  planCodeOf,
  subscriptionSchema,
  transactionSchema,
} from "../paystack/types";
import { applyChargeSuccess } from "../service/charge";
import {
  addDays,
  audit,
  type BillingDeps,
  customerCodeOf,
  isReplacedCode,
  lockCustomer,
  newId,
  type Outcome,
  type SubscriptionRow,
  seal,
  subscriptionByCode,
  TERMINAL_STATUSES,
} from "../service/context";
import { upsertInvoice } from "../service/invoices";
import { applyScheduledSwap } from "../service/sync-remote";

const invoiceSchema = z.looseObject({
  invoice_code: z.string(),
  amount: z.number().int(),
  status: z.string().optional(),
  // Documented as a boolean; tolerate 0/1.
  paid: z
    .union([z.boolean(), z.number()])
    .optional()
    .transform((paid) => (paid === undefined ? undefined : Boolean(paid))),
  period_start: paystackDate,
  period_end: paystackDate,
  paid_at: paystackDate,
  subscription: z.looseObject({ subscription_code: z.string() }),
  // `{}` until a charge is attempted.
  transaction: z
    .looseObject({ reference: z.string().optional() })
    .nullish()
    .catch(null),
});

const date = (value: string | null | undefined) =>
  value ? new Date(value) : null;

/** Routes a stored Paystack event to its handler. Unknown events are
 *  recorded as processed and otherwise ignored. */
export async function dispatchEvent(
  deps: BillingDeps,
  tx: DbOrTx,
  event: string,
  data: unknown
): Promise<Outcome> {
  await lockCustomer(tx, customerCodeOf(data));
  switch (event) {
    case "charge.success":
      return applyChargeSuccess(deps, tx, transactionSchema.parse(data));
    case "subscription.create":
      return onSubscriptionCreate(deps, tx, subscriptionSchema.parse(data));
    case "invoice.create":
    case "invoice.update":
    case "invoice.payment_failed":
      return onInvoice(deps, tx, event, invoiceSchema.parse(data));
    case "subscription.not_renew":
    case "subscription.disable":
      return onSubscriptionStatus(
        deps,
        tx,
        event,
        subscriptionSchema.parse(data)
      );
    case "subscription.expiring_cards":
      return onExpiringCards(deps, tx, data);
    case "refund.processed":
    case "refund.failed":
    case "charge.dispute.create":
    case "charge.dispute.remind":
    case "charge.dispute.resolve":
      return onAuditOnly(deps, tx, event, data);
    default:
      return {};
  }
}

async function onSubscriptionCreate(
  deps: BillingDeps,
  tx: DbOrTx,
  data: z.infer<typeof subscriptionSchema>
): Promise<Outcome> {
  const code = data.subscription_code;
  const token = data.email_token ? seal(deps, data.email_token) : null;
  const next = date(data.next_payment_date);

  const known = await subscriptionByCode(tx, code, { lock: true });
  if (known) {
    await tx
      .update(schema.subscription)
      .set({
        paystackEmailToken: known.paystackEmailToken ?? token,
        // A trial's period is the trial; renewals move it, not this event.
        ...(known.status !== "trialing" && next && !known.currentPeriodEnd
          ? { currentPeriodEnd: next }
          : {}),
      })
      .where(eq(schema.subscription.id, known.id));
    return {};
  }
  const [scheduled] = await tx
    .select()
    .from(schema.subscription)
    .where(eq(schema.subscription.scheduledSubscriptionCode, code));
  if (scheduled) {
    if (!scheduled.scheduledEmailToken && token) {
      await tx
        .update(schema.subscription)
        .set({ scheduledEmailToken: token })
        .where(eq(schema.subscription.id, scheduled.id));
    }
    return {};
  }
  if (await isReplacedCode(tx, code)) {
    return {};
  }

  // New subscription from a checkout: find the org by customer + plan.
  const customerCode =
    typeof data.customer === "object" && data.customer
      ? data.customer.customer_code
      : undefined;
  const planCode = planCodeOf(data.plan);
  if (!(customerCode && planCode)) {
    return { error: "subscription.create without customer or plan" };
  }
  const orgs = await tx
    .select({ organizationId: schema.billingCustomer.organizationId })
    .from(schema.billingCustomer)
    .where(eq(schema.billingCustomer.paystackCustomerCode, customerCode));
  const orgIds = orgs.map((o) => o.organizationId);
  if (orgIds.length === 0) {
    return { error: "unknown customer", retry: true };
  }
  const priceRows = await tx
    .select({ id: schema.planPrice.id })
    .from(schema.planPrice)
    .where(eq(schema.planPrice.paystackPlanCode, planCode));
  const priceIds = priceRows.map((p) => p.id);

  // charge.success already created the row but had no code yet.
  const waiting = await tx
    .select()
    .from(schema.subscription)
    .where(
      and(
        inArray(schema.subscription.organizationId, orgIds),
        isNull(schema.subscription.paystackSubscriptionCode),
        notInArray(schema.subscription.status, [...TERMINAL_STATUSES])
      )
    )
    .for("update");
  const waitingMatch = waiting.filter((s) => priceIds.includes(s.planPriceId));
  if (waitingMatch.length === 1 && waitingMatch[0]) {
    await tx
      .update(schema.subscription)
      .set({
        paystackSubscriptionCode: code,
        paystackEmailToken: token,
        ...(next ? { currentPeriodEnd: next } : {}),
      })
      .where(eq(schema.subscription.id, waitingMatch[0].id));
    return {};
  }

  // subscription.create arrived before charge.success. Paystack only sends
  // it after a successful first charge, so the payload's status stands.
  const intents =
    priceIds.length > 0
      ? await tx
          .select()
          .from(schema.paymentIntent)
          .where(
            and(
              inArray(schema.paymentIntent.organizationId, orgIds),
              inArray(schema.paymentIntent.planPriceId, priceIds),
              eq(schema.paymentIntent.kind, "subscribe")
            )
          )
          .orderBy(desc(schema.paymentIntent.createdAt))
      : [];
  const candidateOrgs = [...new Set(intents.map((i) => i.organizationId))];
  const live = await tx
    .select({ organizationId: schema.subscription.organizationId })
    .from(schema.subscription)
    .where(
      and(
        inArray(
          schema.subscription.organizationId,
          candidateOrgs.length ? candidateOrgs : [""]
        ),
        notInArray(schema.subscription.status, [...TERMINAL_STATUSES])
      )
    );
  const free = candidateOrgs.filter(
    (org) => !live.some((l) => l.organizationId === org)
  );
  const intent = intents.find((i) => i.organizationId === free[0]);
  if (free.length !== 1 || !intent) {
    return {
      error: "cannot match subscription to an organization",
      retry: true,
    };
  }
  const now = deps.now();
  await tx.insert(schema.subscription).values({
    id: newId(),
    organizationId: intent.organizationId,
    planPriceId: intent.planPriceId,
    status: data.status === "active" ? "active" : "incomplete",
    currency: intent.currency,
    paystackSubscriptionCode: code,
    paystackEmailToken: token,
    currentPeriodStart: now,
    currentPeriodEnd: next,
  });
  return {};
}

async function onInvoice(
  deps: BillingDeps,
  tx: DbOrTx,
  event: "invoice.create" | "invoice.update" | "invoice.payment_failed",
  data: z.infer<typeof invoiceSchema>
): Promise<Outcome> {
  const sub = await subscriptionByCode(
    tx,
    data.subscription.subscription_code,
    {
      lock: true,
    }
  );
  if (!sub) {
    return { error: "invoice for unknown or replaced subscription" };
  }
  const periodEnd = date(data.period_end);
  const status =
    event === "invoice.create"
      ? "pending"
      : event === "invoice.payment_failed" || data.status === "failed"
        ? "failed"
        : data.paid || data.status === "success"
          ? "paid"
          : "pending";

  await upsertInvoice(deps, tx, {
    source: "invoice",
    organizationId: sub.organizationId,
    subscriptionId: sub.id,
    invoiceCode: data.invoice_code,
    reference: data.transaction?.reference ?? null,
    amountSubunit: data.amount,
    currency: sub.currency,
    // invoice.create is an upcoming charge (~3 days before). Never paid.
    status,
    periodStart: date(data.period_start),
    periodEnd,
    paidAt: status === "paid" ? (date(data.paid_at) ?? deps.now()) : null,
    kind: "renewal",
    planPriceId: sub.planPriceId,
    raw: data,
  });

  if (status !== "failed") {
    return {};
  }
  // Ignore a failure for a period we have already moved past (a later
  // charge succeeded), or for an invoice that is already paid.
  const [invoiceRow] = await tx
    .select()
    .from(schema.invoice)
    .where(eq(schema.invoice.paystackInvoiceCode, data.invoice_code));
  const stale =
    invoiceRow?.status === "paid" ||
    (periodEnd !== null &&
      sub.currentPeriodEnd !== null &&
      sub.currentPeriodEnd.getTime() > periodEnd.getTime() + 86_400_000);
  if (stale || !["active", "trialing", "past_due"].includes(sub.status)) {
    return {};
  }
  // The renewal that failed was due at the invoice's period start. Grace
  // runs from then, not from when this webhook is processed: a retried or
  // late event (or the simulator's fast-forwarded renewals) must not move
  // the deadline, and each failed period gets its own.
  const due = date(data.period_start) ?? sub.currentPeriodEnd ?? deps.now();
  await markPastDue(deps, tx, sub, due);
  return {};
}

async function markPastDue(
  deps: BillingDeps,
  tx: DbOrTx,
  sub: SubscriptionRow,
  due: Date
) {
  const graceUntil = addDays(due, deps.graceDays);
  await tx
    .update(schema.subscription)
    .set({ status: "past_due", graceUntil })
    .where(eq(schema.subscription.id, sub.id));
  await audit(tx, {
    organizationId: sub.organizationId,
    action: "billing.payment_failed",
    target: sub.paystackSubscriptionCode,
  });
  let manageLink: string | undefined;
  if (sub.paystackSubscriptionCode) {
    try {
      manageLink = (
        await deps.paystack.getManageLink(sub.paystackSubscriptionCode)
      ).link;
    } catch {
      manageLink = undefined;
    }
  }
  await deps.notify?.({
    type: "past_due",
    organizationId: sub.organizationId,
    key: `past_due:${sub.id}:${graceUntil.toISOString()}`,
    planPriceId: sub.planPriceId,
    graceUntil,
    manageLink,
  });
}

async function onSubscriptionStatus(
  deps: BillingDeps,
  tx: DbOrTx,
  event: "subscription.not_renew" | "subscription.disable",
  data: z.infer<typeof subscriptionSchema>
): Promise<Outcome> {
  const code = data.subscription_code;
  const replaced = await isReplacedCode(tx, code);
  if (replaced) {
    // We retired this one during a plan change. Not a cancellation.
    if (event === "subscription.disable" && !replaced.disabledAt) {
      await tx
        .update(schema.replacedSubscription)
        .set({ disabledAt: deps.now() })
        .where(eq(schema.replacedSubscription.paystackSubscriptionCode, code));
    }
    return {};
  }
  const sub = await subscriptionByCode(tx, code, { lock: true });
  if (!sub) {
    return { error: "status event for unknown subscription" };
  }
  if (sub.status === "canceled" || sub.status === "expired") {
    return {};
  }
  const now = deps.now();
  const periodEnded = !sub.currentPeriodEnd || now >= sub.currentPeriodEnd;

  if (event === "subscription.disable" && periodEnded) {
    if (await applyScheduledSwap(deps, tx, sub)) {
      return {};
    }
    await tx
      .update(schema.subscription)
      .set({
        status: "canceled",
        cancelAtPeriodEnd: true,
        canceledAt: sub.canceledAt ?? now,
        endedAt: now,
      })
      .where(eq(schema.subscription.id, sub.id));
    await audit(tx, {
      organizationId: sub.organizationId,
      action: "billing.subscription_ended",
      target: code,
    });
    return {};
  }

  // Cancelled but paid up: keep access until the period end.
  const canceledAt = sub.canceledAt ?? now;
  await tx
    .update(schema.subscription)
    .set({ status: "non_renewing", cancelAtPeriodEnd: true, canceledAt })
    .where(eq(schema.subscription.id, sub.id));
  // Cancelled outside the app (Paystack dashboard, the customer's manage
  // link). Our own cancel already set non_renewing and sent the email.
  if (sub.status !== "non_renewing") {
    await notifyCanceled(deps, sub, canceledAt);
  }
  return {};
}

function notifyCanceled(
  deps: BillingDeps,
  sub: SubscriptionRow,
  canceledAt: Date
) {
  const accessUntil =
    sub.status === "trialing"
      ? (sub.trialEndsAt ?? sub.currentPeriodEnd)
      : sub.currentPeriodEnd;
  return deps.notify?.({
    type: "subscription_canceled",
    organizationId: sub.organizationId,
    key: `canceled:${sub.id}:${canceledAt.toISOString()}`,
    planPriceId: sub.planPriceId,
    accessUntil,
  });
}

async function onExpiringCards(
  deps: BillingDeps,
  tx: DbOrTx,
  data: unknown
): Promise<Outcome> {
  const items = z
    .array(
      z.looseObject({
        subscription: z.looseObject({ subscription_code: z.string() }),
      })
    )
    .catch([])
    .parse(data);
  for (const item of items) {
    const sub = await subscriptionByCode(
      tx,
      item.subscription.subscription_code
    );
    if (!sub) {
      continue;
    }
    await audit(tx, {
      organizationId: sub.organizationId,
      action: "billing.card_expiring",
      target: sub.paystackSubscriptionCode,
    });
    await deps.notify?.({
      type: "expiring_card",
      organizationId: sub.organizationId,
      key: `expiring_card:${sub.id}:${sub.cardExp ?? ""}`,
    });
  }
  return {};
}

async function onAuditOnly(
  deps: BillingDeps,
  tx: DbOrTx,
  event: string,
  data: unknown
): Promise<Outcome> {
  const parsed = z
    .looseObject({
      transaction_reference: z.string().optional(),
      transaction: z
        .looseObject({ reference: z.string().optional() })
        .optional(),
    })
    .catch({})
    .parse(data);
  const reference =
    parsed.transaction_reference ?? parsed.transaction?.reference ?? null;
  let organizationId: string | null = null;
  if (reference) {
    const [intent] = await tx
      .select({ organizationId: schema.paymentIntent.organizationId })
      .from(schema.paymentIntent)
      .where(eq(schema.paymentIntent.id, reference));
    const [inv] = intent
      ? []
      : await tx
          .select({ organizationId: schema.invoice.organizationId })
          .from(schema.invoice)
          .where(eq(schema.invoice.reference, reference));
    organizationId = intent?.organizationId ?? inv?.organizationId ?? null;
  }
  await audit(tx, {
    organizationId,
    action: `paystack.${event}`,
    target: reference,
  });
  if (event === "charge.dispute.create" && organizationId && reference) {
    await deps.notify?.({
      type: "dispute",
      organizationId,
      key: `dispute:${reference}`,
      reference,
    });
  }
  return {};
}

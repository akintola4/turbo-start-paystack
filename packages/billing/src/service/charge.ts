import { type DbOrTx, schema } from "@workspace/db";
import { and, eq, inArray, notInArray } from "drizzle-orm";

import { addInterval, getPlan, getPlanPrice, planChangeKind } from "../catalog";
import { BillingError } from "../errors";
import { type PaystackTransaction, planCodeOf } from "../paystack/types";
import {
  addDays,
  audit,
  type BillingDeps,
  billingCustomer,
  cardFields,
  customerCodeOf,
  liveSubscription,
  lockCustomer,
  newId,
  type Outcome,
  type PaymentIntentRow,
  planPriceRow,
  type SubscriptionRow,
  seal,
  TERMINAL_STATUSES,
  unseal,
} from "./context";
import { upsertInvoice } from "./invoices";
import { createOrAdoptSubscription } from "./paystack-subscription";
import { PlanSwitchError, switchPlanNow } from "./switch-plan";
import { resyncSubscription } from "./sync-remote";

/**
 * Applies a successful charge, whether it arrived as a `charge.success`
 * webhook or from `GET /transaction/verify` on the callback page. Both paths
 * call this inside a transaction; the payment intent row lock plus its
 * status makes the second arrival a no-op.
 */
export async function applyChargeSuccess(
  deps: BillingDeps,
  tx: DbOrTx,
  data: PaystackTransaction
): Promise<Outcome> {
  if (data.status !== "success") {
    return { error: `charge status ${data.status}` };
  }
  // Same lock as the webhook dispatcher: the callback page's verify path
  // must not interleave with subscription.create either.
  await lockCustomer(tx, customerCodeOf(data));
  const [intent] = await tx
    .select()
    .from(schema.paymentIntent)
    .where(eq(schema.paymentIntent.id, data.reference))
    .for("update");
  if (intent) {
    return applyIntentCharge(deps, tx, intent, data);
  }
  return applyRenewalCharge(deps, tx, data);
}

async function applyIntentCharge(
  deps: BillingDeps,
  tx: DbOrTx,
  intent: PaymentIntentRow,
  data: PaystackTransaction
): Promise<Outcome> {
  if (intent.status === "succeeded") {
    return {};
  }
  // Amount, currency and tenant must match what the server asked for. The
  // metadata is ours (set server-side), but it is still checked, not trusted.
  const metadataOrg = data.metadata?.organization_id;
  if (
    data.amount !== intent.amountSubunit ||
    data.currency !== intent.currency ||
    (metadataOrg !== undefined && metadataOrg !== intent.organizationId)
  ) {
    await tx
      .update(schema.paymentIntent)
      .set({ status: "failed" })
      .where(eq(schema.paymentIntent.id, intent.id));
    await audit(tx, {
      organizationId: intent.organizationId,
      action: "billing.charge_mismatch",
      target: intent.id,
      data: {
        expected: { amount: intent.amountSubunit, currency: intent.currency },
        received: { amount: data.amount, currency: data.currency, metadataOrg },
      },
    });
    deps.logger.error("charge does not match its payment intent", {
      reference: intent.id,
    });
    return { error: "charge_mismatch" };
  }

  await tx
    .update(schema.paymentIntent)
    .set({ status: "succeeded" })
    .where(eq(schema.paymentIntent.id, intent.id));

  switch (intent.kind) {
    case "subscribe":
      return activateFromCheckout(deps, tx, intent, data);
    case "trial":
      return startTrialFromCharge(deps, tx, intent, data);
    default:
      return finalizeUpgradeFromCharge(deps, tx, intent, data);
  }
}

async function activateFromCheckout(
  deps: BillingDeps,
  tx: DbOrTx,
  intent: PaymentIntentRow,
  data: PaystackTransaction
): Promise<Outcome> {
  const price = getPlanPrice(intent.planPriceId);
  if (!price) {
    return { error: "unknown plan price" };
  }
  const paidAt = data.paid_at ? new Date(data.paid_at) : deps.now();
  const card = cardFields(deps, data.authorization, data.customer?.email);
  const existing = await liveSubscription(tx, intent.organizationId, {
    lock: true,
  });
  let subscriptionId: string;
  if (existing) {
    // `subscription.create` got here first and created the row.
    subscriptionId = existing.id;
    await tx
      .update(schema.subscription)
      .set({
        ...card,
        status: existing.status === "incomplete" ? "active" : existing.status,
        currentPeriodStart: existing.currentPeriodStart ?? paidAt,
        currentPeriodEnd:
          existing.currentPeriodEnd ?? addInterval(paidAt, price.interval),
      })
      .where(eq(schema.subscription.id, existing.id));
  } else {
    subscriptionId = newId();
    await tx.insert(schema.subscription).values({
      id: subscriptionId,
      organizationId: intent.organizationId,
      planPriceId: intent.planPriceId,
      status: "active",
      currency: intent.currency,
      currentPeriodStart: paidAt,
      currentPeriodEnd: addInterval(paidAt, price.interval),
      ...card,
    });
  }
  const invoiceId = await upsertInvoice(deps, tx, {
    source: "charge",
    organizationId: intent.organizationId,
    subscriptionId,
    reference: data.reference,
    amountSubunit: data.amount,
    currency: data.currency,
    status: "paid",
    paidAt,
    periodStart: paidAt,
    periodEnd: addInterval(paidAt, price.interval),
    description: `${price.planKey} (${price.interval})`,
    kind: "subscription",
    planPriceId: intent.planPriceId,
    card: data.authorization,
  });
  await audit(tx, {
    organizationId: intent.organizationId,
    actorUserId: intent.createdByUserId,
    action: "billing.subscribed",
    data: { planPriceId: intent.planPriceId, reference: data.reference },
  });
  await deps.notify?.({
    type: "payment_succeeded",
    organizationId: intent.organizationId,
    key: `receipt:${data.reference}`,
    planPriceId: intent.planPriceId,
    invoiceId,
    amountSubunit: data.amount,
    currency: data.currency,
    reference: data.reference,
    paidAt,
    periodStart: paidAt,
    periodEnd: addInterval(paidAt, price.interval),
  });
  return {};
}

/**
 * Card-up-front trial: the tokenisation charge succeeded, so create the real
 * Paystack subscription starting when the trial ends, then refund the charge.
 */
async function startTrialFromCharge(
  deps: BillingDeps,
  tx: DbOrTx,
  intent: PaymentIntentRow,
  data: PaystackTransaction
): Promise<Outcome> {
  const price = getPlanPrice(intent.planPriceId);
  const plan = price && getPlan(price.planKey);
  const row = await planPriceRow(tx, intent.planPriceId);
  const customer = await billingCustomer(tx, intent.organizationId);
  if (!(price && plan && row?.paystackPlanCode && customer)) {
    return { error: "trial plan or customer missing" };
  }
  /** True when Paystack accepted the refund request. */
  const refund = async () => {
    try {
      await deps.paystack.refund({ transaction: data.reference });
      return true;
    } catch (error) {
      deps.logger.warn("tokenisation refund failed", {
        reference: data.reference,
        error: String(error),
      });
      await audit(tx, {
        organizationId: intent.organizationId,
        action: "billing.refund_failed",
        target: data.reference,
      });
      return false;
    }
  };

  if (!data.authorization?.reusable) {
    await refund();
    await audit(tx, {
      organizationId: intent.organizationId,
      action: "billing.trial_card_not_reusable",
      target: data.reference,
    });
    return { error: "card_not_reusable" };
  }
  if (await liveSubscription(tx, intent.organizationId, { lock: true })) {
    return {};
  }

  const now = deps.now();
  const trialEndsAt = addDays(now, plan.trialDays);
  const subscriptionId = newId();
  await tx.insert(schema.subscription).values({
    id: subscriptionId,
    organizationId: intent.organizationId,
    planPriceId: intent.planPriceId,
    status: "trialing",
    currency: intent.currency,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    trialEndsAt,
    ...cardFields(deps, data.authorization, data.customer?.email),
  });
  const created = await createOrAdoptSubscription(deps, tx, {
    customer: customer.paystackCustomerCode,
    plan: row.paystackPlanCode,
    authorization: data.authorization.authorization_code,
    start_date: trialEndsAt.toISOString(),
  });
  await tx
    .update(schema.subscription)
    .set({
      paystackSubscriptionCode: created.subscription_code,
      paystackEmailToken: created.email_token
        ? seal(deps, created.email_token)
        : null,
    })
    .where(eq(schema.subscription.id, subscriptionId));
  const refundAccepted = await refund();
  await upsertInvoice(deps, tx, {
    source: "charge",
    organizationId: intent.organizationId,
    subscriptionId,
    reference: data.reference,
    amountSubunit: data.amount,
    currency: data.currency,
    status: "void",
    paidAt: now,
    description: "Card verification (refunded)",
    kind: "card_check",
    planPriceId: intent.planPriceId,
    card: data.authorization,
    refundRequestedAt: refundAccepted ? now : null,
  });
  await audit(tx, {
    organizationId: intent.organizationId,
    actorUserId: intent.createdByUserId,
    action: "billing.trial_started",
    data: { planPriceId: intent.planPriceId, trialEndsAt },
  });
  await deps.notify?.({
    type: "trial_started",
    organizationId: intent.organizationId,
    key: `trial_started:${subscriptionId}`,
    planPriceId: intent.planPriceId,
    trialEndsAt,
  });
  return {};
}

/** The upgrade's proration was paid through checkout (fallback) or arrived
 *  late: finish the plan switch. If the switch can't be made (target plan
 *  not synced, no billing customer or card, Paystack refusing the new
 *  subscription) switchPlanNow refunds the charge and it is recorded void.
 *  A later delivery of the same charge finds that void row and goes the
 *  stale way: no switch, even if one would now succeed, and no second
 *  refund unless Paystack refused the first. */
async function finalizeUpgradeFromCharge(
  deps: BillingDeps,
  tx: DbOrTx,
  intent: PaymentIntentRow,
  data: PaystackTransaction
): Promise<Outcome> {
  const sub = await liveSubscription(tx, intent.organizationId, { lock: true });
  const paidAt = data.paid_at ? new Date(data.paid_at) : deps.now();
  const [prior] = await tx
    .select({ status: schema.invoice.status })
    .from(schema.invoice)
    .where(eq(schema.invoice.reference, data.reference));
  const stale =
    (prior?.status === "void" ? "upgrade_failed" : null) ??
    staleUpgradeReason(intent, sub, paidAt) ??
    (sub && alreadyUpgraded(sub.planPriceId, intent.planPriceId)
      ? "already_upgraded"
      : null);
  if (stale || !sub) {
    return refundStaleUpgrade(
      deps,
      tx,
      intent,
      data,
      sub,
      stale ?? "no_subscription"
    );
  }
  const newCard = cardFields(deps, data.authorization, data.customer?.email);
  const authorizationCode =
    (data.authorization?.reusable
      ? data.authorization.authorization_code
      : null) ?? unseal(deps, sub.authorizationCode);
  try {
    await switchPlanNow(deps, tx, sub, {
      targetPlanPriceId: intent.planPriceId,
      authorizationCode,
      actorUserId: intent.createdByUserId,
      newCard,
      refundReference: data.reference,
    });
  } catch (error) {
    if (!(error instanceof BillingError)) {
      throw error;
    }
    // switchPlanNow changed nothing, audited the failure and refunded the
    // charge; the void row records whether Paystack accepted that refund.
    await tx
      .update(schema.paymentIntent)
      .set({ status: "failed" })
      .where(eq(schema.paymentIntent.id, intent.id));
    await upsertInvoice(deps, tx, {
      source: "charge",
      organizationId: intent.organizationId,
      subscriptionId: sub.id,
      reference: data.reference,
      amountSubunit: data.amount,
      currency: data.currency,
      status: "void",
      paidAt,
      description: "Plan upgrade (refunded)",
      kind: "proration",
      planPriceId: intent.planPriceId,
      card: data.authorization,
      refundRequestedAt:
        error instanceof PlanSwitchError ? error.refundRequestedAt : null,
    });
    return { error: error.code };
  }
  await upsertInvoice(deps, tx, {
    source: "charge",
    organizationId: intent.organizationId,
    subscriptionId: sub.id,
    reference: data.reference,
    amountSubunit: data.amount,
    currency: data.currency,
    status: "paid",
    paidAt,
    description: "Plan upgrade (prorated)",
    kind: "proration",
    planPriceId: intent.planPriceId,
    card: data.authorization,
  });
  await deps.notify?.({
    type: "plan_changed",
    organizationId: intent.organizationId,
    key: `plan_changed:${data.reference}`,
    change: "upgrade",
    fromPlanPriceId: sub.planPriceId,
    toPlanPriceId: intent.planPriceId,
    chargedSubunit: data.amount,
    currency: data.currency,
    effectiveAt: paidAt,
  });
  return {};
}

/**
 * Why an upgrade or proration charge must not be applied, or null if it can
 * be. The amount was prorated for the period the intent was created in; paid
 * after a renewal (or after it expired) it would buy the bigger plan for a
 * whole new period at a few days' price.
 */
export function staleUpgradeReason(
  intent: Pick<PaymentIntentRow, "createdAt" | "periodStart" | "expiresAt">,
  sub: Pick<SubscriptionRow, "currentPeriodStart"> | null,
  paidAt: Date
): string | null {
  if (!sub) {
    return "no_subscription";
  }
  if (intent.expiresAt && paidAt > intent.expiresAt) {
    return "expired";
  }
  const periodStart = sub.currentPeriodStart?.getTime();
  if (periodStart === undefined) {
    return null;
  }
  // Rows from before the period was recorded fall back to their creation
  // time: an intent created before this period began belongs to an older one.
  const anchor = intent.periodStart?.getTime();
  if (
    anchor === undefined
      ? intent.createdAt.getTime() < periodStart
      : anchor !== periodStart
  ) {
    return "period_changed";
  }
  return null;
}

/**
 * True when the organization is already on the intent's plan, or on one it
 * would not be an upgrade to. A second upgrade payment for the same change
 * (the saved-card charge went through while its response was lost, and the
 * customer also paid a fallback checkout) lands here and is refunded.
 */
export function alreadyUpgraded(
  currentPlanPriceId: string,
  targetPlanPriceId: string
): boolean {
  if (currentPlanPriceId === targetPlanPriceId) {
    return true;
  }
  const current = getPlanPrice(currentPlanPriceId);
  const target = getPlanPrice(targetPlanPriceId);
  const currentPlan = current && getPlan(current.planKey);
  const targetPlan = target && getPlan(target.planKey);
  if (!(current && target && currentPlan && targetPlan)) {
    return false;
  }
  return (
    planChangeKind(
      { rank: currentPlan.rank, interval: current.interval },
      { rank: targetPlan.rank, interval: target.interval }
    ) !== "upgrade"
  );
}

const STALE_DESCRIPTION: Record<string, string> = {
  already_upgraded: "Plan upgrade (already paid, refunded)",
  upgrade_failed: "Plan upgrade (refunded)",
};

/** The money for a stale upgrade goes back; the plan does not change. A
 *  failed refund is left on the audit log (and the void invoice without a refund
 *  request date) for someone to settle, and is retried if the charge is
 *  applied again. */
async function refundStaleUpgrade(
  deps: BillingDeps,
  tx: DbOrTx,
  intent: PaymentIntentRow,
  data: PaystackTransaction,
  sub: SubscriptionRow | null,
  reason: string
): Promise<Outcome> {
  await tx
    .update(schema.paymentIntent)
    .set({ status: "failed" })
    .where(eq(schema.paymentIntent.id, intent.id));
  const [existing] = await tx
    .select({ requestedAt: schema.invoice.refundRequestedAt })
    .from(schema.invoice)
    .where(eq(schema.invoice.reference, data.reference));
  if (existing?.requestedAt) {
    return { error: `stale_upgrade:${reason}` };
  }
  let refundRequestedAt: Date | null = null;
  try {
    await deps.paystack.refund({ transaction: data.reference });
    refundRequestedAt = deps.now();
  } catch (error) {
    deps.logger.error("refund of a stale upgrade charge failed", {
      reference: data.reference,
      error: String(error),
    });
    await audit(tx, {
      organizationId: intent.organizationId,
      action: "billing.refund_failed",
      target: data.reference,
      data: { reason: `stale_upgrade:${reason}` },
    });
  }
  await upsertInvoice(deps, tx, {
    source: "charge",
    organizationId: intent.organizationId,
    subscriptionId: sub?.id ?? null,
    reference: data.reference,
    amountSubunit: data.amount,
    currency: data.currency,
    status: "void",
    paidAt: data.paid_at ? new Date(data.paid_at) : deps.now(),
    description:
      STALE_DESCRIPTION[reason] ?? "Plan upgrade (expired, refunded)",
    kind: "proration",
    planPriceId: intent.planPriceId,
    card: data.authorization,
    refundRequestedAt,
  });
  await audit(tx, {
    organizationId: intent.organizationId,
    actorUserId: intent.createdByUserId,
    action: "billing.stale_upgrade_refunded",
    target: data.reference,
    data: {
      reason,
      planPriceId: intent.planPriceId,
      refunded: !!refundRequestedAt,
    },
  });
  return { error: `stale_upgrade:${reason}` };
}

/**
 * Organizations created before each got its own Paystack customer can share
 * one, so a renewal charge can match several rows. Paystack's view, applied
 * by the resync, moved the period (or swapped the plan) of the one that
 * renewed: that is the one the charge was for, if exactly one moved.
 */
async function renewedAmong(
  tx: DbOrTx,
  before: SubscriptionRow[]
): Promise<SubscriptionRow | undefined> {
  const after = await tx
    .select()
    .from(schema.subscription)
    .where(
      inArray(
        schema.subscription.id,
        before.map((s) => s.id)
      )
    );
  const moved = before.filter((old) => {
    const now = after.find((s) => s.id === old.id);
    return (
      now &&
      (now.currentPeriodEnd?.getTime() !== old.currentPeriodEnd?.getTime() ||
        now.planPriceId !== old.planPriceId)
    );
  });
  return moved.length === 1 ? moved[0] : undefined;
}

/**
 * A one-off charge with no plan that we didn't start: the customer updating
 * the card on Paystack's subscription manage page charges the new card. The
 * charge itself doesn't name the subscription, so the card is re-read from
 * Paystack: `GET /subscription/:code` returns the subscription's current
 * `authorization`, and that is stored (code, last4, expiry, brand). Only
 * subscriptions now on the card this charge used are touched, so an
 * unrelated one-off charge changes nothing. Paystack marks these charges
 * `metadata.transaction_type: "update_card"`.
 */
async function applyCardUpdateCharge(
  deps: BillingDeps,
  tx: DbOrTx,
  data: PaystackTransaction,
  customerCode: string
): Promise<Outcome> {
  const used = data.authorization?.authorization_code;
  if (!used) {
    return { error: "charge not linked to a subscription" };
  }
  const rows = await tx
    .select({ sub: schema.subscription })
    .from(schema.subscription)
    .innerJoin(
      schema.billingCustomer,
      eq(
        schema.subscription.organizationId,
        schema.billingCustomer.organizationId
      )
    )
    .where(
      and(
        eq(schema.billingCustomer.paystackCustomerCode, customerCode),
        notInArray(schema.subscription.status, [...TERMINAL_STATUSES])
      )
    )
    .for("update", { of: schema.subscription });
  let updated = 0;
  for (const { sub } of rows) {
    const codes = [
      sub.paystackSubscriptionCode,
      sub.scheduledSubscriptionCode,
    ].filter((c): c is string => Boolean(c));
    for (const code of codes) {
      const remote = await deps.paystack.fetchSubscription(code);
      const auth = remote.authorization;
      if (
        !(auth && typeof auth === "object") ||
        auth.authorization_code !== used
      ) {
        continue;
      }
      const fields = cardFields(deps, auth, data.customer?.email);
      if (!fields.authorizationCode) {
        continue;
      }
      await tx
        .update(schema.subscription)
        .set(fields)
        .where(eq(schema.subscription.id, sub.id));
      await audit(tx, {
        organizationId: sub.organizationId,
        actorUserId: null,
        action: "billing.card_updated",
        data: { subscription: code, last4: auth.last4 ?? null },
      });
      updated += 1;
      break;
    }
  }
  if (updated > 0) {
    return {};
  }
  // Paystack can move the subscription onto the new card after this webhook
  // (and test mode never does), so a card update is retried by reconcile,
  // up to MAX_EVENT_ATTEMPTS, rather than dropped.
  if (data.metadata?.transaction_type === "update_card") {
    return { error: "card update not on the subscription yet", retry: true };
  }
  return { error: "charge not linked to a subscription" };
}

/**
 * A charge we did not initiate directly: a Paystack-scheduled renewal (or the
 * first charge after a trial or a scheduled downgrade). Matched on customer +
 * plan code, then re-derived from `GET /subscription/:code`, because a
 * Paystack customer from before customers were per organization can still
 * pay for several of them.
 */
async function applyRenewalCharge(
  deps: BillingDeps,
  tx: DbOrTx,
  data: PaystackTransaction
): Promise<Outcome> {
  const planCode = planCodeOf(data.plan);
  const customerCode = data.customer?.customer_code;
  if (customerCode && !planCode) {
    return applyCardUpdateCharge(deps, tx, data, customerCode);
  }
  if (!(planCode && customerCode)) {
    return { error: "charge not linked to a subscription" };
  }
  const prices = await tx
    .select({ id: schema.planPrice.id })
    .from(schema.planPrice)
    .where(eq(schema.planPrice.paystackPlanCode, planCode));
  const priceIds = prices.map((p) => p.id);
  if (priceIds.length === 0) {
    return { error: "unknown plan code" };
  }
  const rows = await tx
    .select({ sub: schema.subscription })
    .from(schema.subscription)
    .innerJoin(
      schema.billingCustomer,
      eq(
        schema.subscription.organizationId,
        schema.billingCustomer.organizationId
      )
    )
    .where(
      and(
        eq(schema.billingCustomer.paystackCustomerCode, customerCode),
        notInArray(schema.subscription.status, [...TERMINAL_STATUSES])
      )
    )
    .for("update", { of: schema.subscription });
  const candidates = rows
    .map((r) => r.sub)
    .filter(
      (s) =>
        priceIds.includes(s.planPriceId) ||
        (s.scheduledPlanPriceId !== null &&
          priceIds.includes(s.scheduledPlanPriceId))
    );
  if (candidates.length === 0) {
    // The subscription row may not exist yet; reconcile retries this event.
    return { error: "no subscription for renewal charge", retry: true };
  }
  const paidAt = data.paid_at ? new Date(data.paid_at) : deps.now();
  for (const sub of candidates) {
    await resyncSubscription(deps, tx, sub, { paidAt });
  }
  const only =
    candidates.length === 1
      ? candidates[0]
      : await renewedAmong(tx, candidates);
  if (only) {
    await tx
      .update(schema.subscription)
      .set(cardFields(deps, data.authorization, data.customer?.email))
      .where(
        and(
          eq(schema.subscription.id, only.id),
          inArray(schema.subscription.status, [
            "active",
            "past_due",
            "trialing",
          ])
        )
      );
    // Resync may have moved the period or swapped in a scheduled plan.
    const [renewed] = await tx
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.id, only.id));
    const invoiceId = await upsertInvoice(deps, tx, {
      source: "charge",
      organizationId: only.organizationId,
      subscriptionId: only.id,
      reference: data.reference,
      amountSubunit: data.amount,
      currency: data.currency,
      status: "paid",
      paidAt,
      description: "Renewal",
      kind: "renewal",
      // The plan this charge was for: its plan code, not the row's plan.
      planPriceId:
        renewed && priceIds.includes(renewed.planPriceId)
          ? renewed.planPriceId
          : (priceIds[0] ?? null),
      card: data.authorization,
    });
    await deps.notify?.({
      type: "payment_succeeded",
      organizationId: only.organizationId,
      key: `receipt:${data.reference}`,
      planPriceId: renewed?.planPriceId ?? only.planPriceId,
      invoiceId,
      amountSubunit: data.amount,
      currency: data.currency,
      reference: data.reference,
      paidAt,
      periodStart: renewed?.currentPeriodStart ?? null,
      periodEnd: renewed?.currentPeriodEnd ?? null,
    });
  }
  return {};
}

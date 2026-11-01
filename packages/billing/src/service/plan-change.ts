import { type DbOrTx, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { getPlan, getPlanPrice, planChangeKind } from "../catalog";
import { BillingError, PaystackError } from "../errors";
import { upgradeChargeNow } from "../proration";
import type { Actor } from "./checkout";
import {
  audit,
  type BillingDeps,
  billingCustomer,
  isReplacedCode,
  liveSubscription,
  newReference,
  planPriceRow,
  type SubscriptionRow,
  seal,
  transactionWithNotifications,
  unseal,
} from "./context";
import { upsertInvoice } from "./invoices";
import { createOrAdoptSubscription } from "./paystack-subscription";
import {
  emailTokenFor,
  PlanSwitchError,
  retireSubscription,
  switchPlanNow,
} from "./switch-plan";

export type ChangePlanResult =
  | { kind: "upgraded"; charged: number }
  | {
      kind: "checkout_required";
      reference: string;
      accessCode: string;
      authorizationUrl: string;
      amountSubunit: number;
    }
  | {
      /** The saved-card charge's result was lost and Paystack can't say yet
       *  whether it went through. The upgrade completes from its webhook
       *  or reconcile; the customer must not be asked to pay again. */
      kind: "payment_pending";
      reference: string;
      amountSubunit: number;
    }
  | { kind: "downgrade_scheduled"; effectiveAt: Date }
  | { kind: "downgrade_canceled" };

type ChargeAttempt =
  | { outcome: "paid" }
  | { outcome: "paused"; authorizationUrl: string }
  | { outcome: "declined" }
  | { outcome: "unknown" };

/** Transaction statuses that mean no money moved, or it went back. */
const NOT_CHARGED = new Set(["failed", "reversed", "abandoned"]);

/**
 * Charges the saved card. A thrown error (a timeout, a 5xx whose retry hit
 * "Duplicate Transaction Reference", a status we don't expect) says nothing
 * about whether the card was charged, so the reference is verified before
 * anything else is decided. Only Paystack saying "failed" or "not found"
 * counts as a decline; anything it can't confirm is `unknown`.
 */
async function chargeOrVerify(
  deps: BillingDeps,
  input: Parameters<BillingDeps["paystack"]["chargeAuthorization"]>[0]
): Promise<ChargeAttempt> {
  try {
    const result = await deps.paystack.chargeAuthorization(input);
    if (result.paused && result.authorization_url) {
      return { outcome: "paused", authorizationUrl: result.authorization_url };
    }
    if (result.status === "success" && !result.paused) {
      return { outcome: "paid" };
    }
    if (result.status === "failed") {
      return { outcome: "declined" };
    }
    deps.logger.warn("upgrade charge returned an unexpected status", {
      reference: input.reference,
      status: result.status,
    });
  } catch (error) {
    deps.logger.warn("upgrade charge failed without an answer; verifying", {
      reference: input.reference,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    const tx = await deps.paystack.verifyTransaction(input.reference);
    if (
      tx.status === "success" &&
      tx.amount === input.amount &&
      tx.currency === input.currency
    ) {
      return { outcome: "paid" };
    }
    return NOT_CHARGED.has(tx.status)
      ? { outcome: "declined" }
      : { outcome: "unknown" };
  } catch (error) {
    // Paystack answers an unknown reference with a 4xx: never charged.
    if (error instanceof PaystackError && error.httpStatus < 500) {
      return { outcome: "declined" };
    }
    deps.logger.error("could not verify the upgrade charge", {
      reference: input.reference,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: "unknown" };
  }
}

/** How long an upgrade checkout stays payable. The prorated amount is only
 *  right for the moment it was priced, so it is kept short. */
export const UPGRADE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

/** The billing period an upgrade intent was priced for, and when it stops
 *  being payable: a day later, or the period end if that comes first. */
function upgradeIntentWindow(
  sub: { currentPeriodStart: Date | null; currentPeriodEnd: Date | null },
  now: Date
) {
  const ttl = new Date(now.getTime() + UPGRADE_INTENT_TTL_MS);
  const end = sub.currentPeriodEnd;
  return {
    periodStart: sub.currentPeriodStart,
    expiresAt: end && end < ttl ? end : ttl,
  };
}

/**
 * Upgrade: immediate, prorated. Charge the difference for the rest of the
 * period on the saved card (`charge_authorization`), then switch. If the card
 * charge fails (or needs 2FA) the customer pays the same amount through
 * checkout and the switch completes from that charge's webhook.
 *
 * Downgrade: at period end. The replacement Paystack subscription is created
 * now with `start_date = current_period_end`, then the old one is disabled,
 * so the old price can never renew in between.
 */
export async function changePlan(
  deps: BillingDeps,
  input: {
    organizationId: string;
    actor: Actor;
    planPriceId: string;
    memberCount: number;
  }
): Promise<ChangePlanResult> {
  const target = getPlanPrice(input.planPriceId);
  const targetPlan = target && getPlan(target.planKey);
  if (!(target && targetPlan)) {
    throw new BillingError("plan_not_found", "Unknown plan");
  }
  // A failure after money moved (charge, then refund) is committed before it
  // is surfaced, so the audit trail and intent status survive.
  const outcome = await transactionWithNotifications(
    deps,
    async (
      tx,
      scoped
    ): Promise<ChangePlanResult | { failed: BillingError }> => {
      const sub = await liveSubscription(tx, input.organizationId, {
        lock: true,
      });
      if (!sub) {
        throw new BillingError("no_subscription", "Subscribe first.");
      }
      if (!["active", "trialing"].includes(sub.status)) {
        throw new BillingError(
          "invalid_state",
          sub.status === "past_due"
            ? "Update your card before changing plan."
            : "Resume the subscription before changing plan."
        );
      }
      // Asking for the current plan while a downgrade is scheduled keeps it.
      const keeping = sub.planPriceId === target.id;
      if (keeping && !sub.scheduledSubscriptionCode) {
        throw new BillingError("same_plan", "Already on this plan.");
      }
      const current = getPlanPrice(sub.planPriceId);
      const currentPlan = current && getPlan(current.planKey);
      if (!(current && currentPlan)) {
        throw new BillingError("plan_not_found", "Current plan is unknown");
      }
      if (target.currency !== sub.currency) {
        throw new BillingError(
          "currency_locked",
          `This organization is billed in ${sub.currency}.`
        );
      }
      const row = await planPriceRow(tx, target.id);
      if (!row?.paystackPlanCode) {
        throw new BillingError("plan_not_synced", "Target plan is not synced");
      }
      const authorizationCode = unseal(deps, sub.authorizationCode);
      if (!authorizationCode) {
        throw new BillingError("no_card", "No reusable card on file.");
      }
      if (keeping) {
        await keepCurrentPlan(deps, tx, sub, {
          paystackPlanCode: row.paystackPlanCode,
          authorizationCode,
          actorUserId: input.actor.userId,
        });
        return { kind: "downgrade_canceled" };
      }

      const notifyChange = (input: {
        key: string;
        change: "upgrade" | "downgrade";
        chargedSubunit: number;
        effectiveAt: Date;
      }) =>
        scoped.notify?.({
          type: "plan_changed",
          organizationId: sub.organizationId,
          fromPlanPriceId: sub.planPriceId,
          toPlanPriceId: target.id,
          currency: sub.currency,
          ...input,
        });

      const isUpgrade =
        planChangeKind(
          { rank: currentPlan.rank, interval: current.interval },
          { rank: targetPlan.rank, interval: target.interval }
        ) === "upgrade";

      if (!isUpgrade) {
        if (input.memberCount > targetPlan.limits.members) {
          throw new BillingError(
            "over_member_limit",
            `${targetPlan.name} allows ${targetPlan.limits.members} members; remove ${input.memberCount - targetPlan.limits.members} first.`
          );
        }
        const effectiveAt = sub.currentPeriodEnd ?? deps.now();
        // Asking for the downgrade that is already scheduled changes nothing.
        if (
          sub.scheduledSubscriptionCode &&
          sub.scheduledPlanPriceId === target.id
        ) {
          return { kind: "downgrade_scheduled", effectiveAt };
        }
        const customer = await billingCustomer(tx, input.organizationId);
        if (!customer) {
          throw new BillingError("no_subscription", "No billing customer");
        }
        const created = await createOrAdoptSubscription(deps, tx, {
          customer: customer.paystackCustomerCode,
          plan: row.paystackPlanCode,
          authorization: authorizationCode,
          start_date: effectiveAt.toISOString(),
        }).catch(() => {
          throw new BillingError(
            "downgrade_failed",
            "Could not schedule the downgrade. Nothing was changed."
          );
        });
        // A different downgrade was already scheduled: its Paystack
        // subscription would still start (and charge) at period end, so it is
        // retired now that its replacement exists.
        if (sub.scheduledSubscriptionCode) {
          await retireSubscription(
            deps,
            tx,
            sub.organizationId,
            sub.scheduledSubscriptionCode,
            sub.scheduledEmailToken
          );
        }
        const currentRetired =
          sub.paystackSubscriptionCode &&
          (await isReplacedCode(tx, sub.paystackSubscriptionCode))?.disabledAt;
        if (sub.paystackSubscriptionCode && !currentRetired) {
          await retireSubscription(
            deps,
            tx,
            sub.organizationId,
            sub.paystackSubscriptionCode,
            sub.paystackEmailToken
          );
        }
        await tx
          .update(schema.subscription)
          .set({
            scheduledPlanPriceId: target.id,
            scheduledSubscriptionCode: created.subscription_code,
            scheduledEmailToken: created.email_token
              ? seal(deps, created.email_token)
              : null,
          })
          .where(eq(schema.subscription.id, sub.id));
        await audit(tx, {
          organizationId: sub.organizationId,
          actorUserId: input.actor.userId,
          action: "billing.downgrade_scheduled",
          data: { from: sub.planPriceId, to: target.id, effectiveAt },
        });
        await notifyChange({
          key: `plan_changed:${sub.id}:${created.subscription_code}`,
          change: "downgrade",
          chargedSubunit: 0,
          effectiveAt,
        });
        return { kind: "downgrade_scheduled", effectiveAt };
      }

      // Upgrade. switchPlanNow needs the target's plan code (checked above)
      // and the billing customer; without either the upgrade is refused
      // here, before any money moves.
      const customer = await billingCustomer(tx, sub.organizationId);
      if (!customer) {
        throw new BillingError("plan_not_synced", "No billing customer");
      }
      // Nothing is owed for unpaid trial time.
      // Below Paystack's minimum card charge the difference is waived.
      const now = deps.now();
      const charge = upgradeChargeNow({ sub, current, target, now });

      if (charge === 0) {
        await switchPlanNow(deps, tx, sub, {
          targetPlanPriceId: target.id,
          authorizationCode,
          actorUserId: input.actor.userId,
        });
        await notifyChange({
          key: `plan_changed:${sub.id}:${target.id}:${now.toISOString()}`,
          change: "upgrade",
          chargedSubunit: 0,
          effectiveAt: now,
        });
        return { kind: "upgraded", charged: 0 };
      }

      const reference = newReference();
      const anchor = upgradeIntentWindow(sub, now);
      await tx.insert(schema.paymentIntent).values({
        id: reference,
        organizationId: sub.organizationId,
        kind: "proration",
        planPriceId: target.id,
        amountSubunit: charge,
        currency: sub.currency,
        createdByUserId: input.actor.userId,
        createdAt: deps.now(),
        ...anchor,
      });
      const email =
        sub.authorizationEmail ?? customer.email ?? input.actor.email;
      const metadata = {
        organization_id: sub.organizationId,
        payment_intent_id: reference,
        plan_price_id: target.id,
        kind: "proration",
      };
      const result = await chargeOrVerify(deps, {
        email,
        amount: charge,
        currency: sub.currency,
        authorization_code: authorizationCode,
        reference,
        metadata,
      });

      if (result.outcome === "unknown") {
        // The charge may have gone through. The intent stays open: its
        // charge.success webhook, the callback page or reconcile finish the
        // upgrade, and nothing else is charged in the meantime.
        await audit(tx, {
          organizationId: sub.organizationId,
          actorUserId: input.actor.userId,
          action: "billing.upgrade_charge_unconfirmed",
          target: reference,
          data: { to: target.id, amount: charge },
        });
        return { kind: "payment_pending", reference, amountSubunit: charge };
      }

      if (result.outcome === "paid") {
        await tx
          .update(schema.paymentIntent)
          .set({ status: "succeeded" })
          .where(eq(schema.paymentIntent.id, reference));
        try {
          await switchPlanNow(deps, tx, sub, {
            targetPlanPriceId: target.id,
            authorizationCode,
            actorUserId: input.actor.userId,
            refundReference: reference,
          });
        } catch (error) {
          if (!(error instanceof BillingError)) {
            throw error;
          }
          await tx
            .update(schema.paymentIntent)
            .set({ status: "failed" })
            .where(eq(schema.paymentIntent.id, reference));
          await upsertInvoice(deps, tx, {
            source: "charge",
            organizationId: sub.organizationId,
            subscriptionId: sub.id,
            reference,
            amountSubunit: charge,
            currency: sub.currency,
            status: "void",
            description: "Plan upgrade (refunded)",
            kind: "proration",
            planPriceId: target.id,
            refundRequestedAt:
              error instanceof PlanSwitchError ? error.refundRequestedAt : null,
          });
          return { failed: error };
        }
        await upsertInvoice(deps, tx, {
          source: "charge",
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          reference,
          amountSubunit: charge,
          currency: sub.currency,
          status: "paid",
          paidAt: now,
          description: "Plan upgrade (prorated)",
          kind: "proration",
          planPriceId: target.id,
        });
        await notifyChange({
          key: `plan_changed:${reference}`,
          change: "upgrade",
          chargedSubunit: charge,
          effectiveAt: now,
        });
        return { kind: "upgraded", charged: charge };
      }

      if (result.outcome === "paused") {
        // The bank wants the customer present (2FA). The webhook for this
        // reference completes the upgrade.
        return {
          kind: "checkout_required",
          reference,
          accessCode: "",
          authorizationUrl: result.authorizationUrl,
          amountSubunit: charge,
        };
      }

      // Card declined (or Paystack confirms the charge never happened): fall
      // back to a checkout for the same amount.
      await tx
        .update(schema.paymentIntent)
        .set({ status: "failed" })
        .where(eq(schema.paymentIntent.id, reference));
      const fallback = newReference();
      await tx.insert(schema.paymentIntent).values({
        id: fallback,
        organizationId: sub.organizationId,
        kind: "upgrade",
        planPriceId: target.id,
        amountSubunit: charge,
        currency: sub.currency,
        createdByUserId: input.actor.userId,
        createdAt: deps.now(),
        ...anchor,
      });
      const init = await deps.paystack.initializeTransaction({
        email,
        amount: charge,
        currency: sub.currency,
        reference: fallback,
        callback_url: deps.callbackUrl,
        channels: ["card"],
        metadata: { ...metadata, payment_intent_id: fallback, kind: "upgrade" },
      });
      await tx
        .update(schema.paymentIntent)
        .set({ accessCode: init.access_code })
        .where(eq(schema.paymentIntent.id, fallback));
      return {
        kind: "checkout_required",
        reference: fallback,
        accessCode: init.access_code,
        authorizationUrl: init.authorization_url,
        amountSubunit: charge,
      };
    }
  );
  if ("failed" in outcome) {
    throw outcome.failed;
  }
  return outcome;
}

/**
 * Undo a scheduled downgrade. Scheduling it disabled the current Paystack
 * subscription, and Paystack can't re-enable a disabled one, so (as with
 * resume) this creates a new subscription on the current plan and saved card,
 * starting when the current period or trial ends, then retires the scheduled
 * one. Created first, so a Paystack failure leaves the downgrade in place.
 */
async function keepCurrentPlan(
  deps: BillingDeps,
  tx: DbOrTx,
  sub: SubscriptionRow,
  input: {
    paystackPlanCode: string;
    authorizationCode: string;
    actorUserId: string;
  }
) {
  const now = deps.now();
  const customer = await billingCustomer(tx, sub.organizationId);
  if (!customer) {
    throw new BillingError("no_subscription", "No billing customer");
  }
  const trialing = Boolean(sub.trialEndsAt && now < sub.trialEndsAt);
  const startDate = (trialing ? sub.trialEndsAt : sub.currentPeriodEnd) ?? now;
  let created: Awaited<ReturnType<typeof deps.paystack.createSubscription>>;
  try {
    created = await createOrAdoptSubscription(deps, tx, {
      customer: customer.paystackCustomerCode,
      plan: input.paystackPlanCode,
      authorization: input.authorizationCode,
      start_date: startDate.toISOString(),
    });
  } catch (error) {
    deps.logger.error("keeping the plan could not create a subscription", {
      organizationId: sub.organizationId,
      error: String(error),
    });
    throw new BillingError(
      "paystack_error",
      "Paystack couldn't keep the plan. The downgrade is still scheduled."
    );
  }
  if (sub.scheduledSubscriptionCode) {
    await retireSubscription(
      deps,
      tx,
      sub.organizationId,
      sub.scheduledSubscriptionCode,
      sub.scheduledEmailToken
    );
  }
  // Normally already retired when the downgrade was scheduled; if that
  // disable failed, retire it now so it can't renew beside its replacement.
  const currentRetired =
    sub.paystackSubscriptionCode &&
    (await isReplacedCode(tx, sub.paystackSubscriptionCode))?.disabledAt;
  if (sub.paystackSubscriptionCode && !currentRetired) {
    await retireSubscription(
      deps,
      tx,
      sub.organizationId,
      sub.paystackSubscriptionCode,
      sub.paystackEmailToken
    );
  }
  await tx
    .update(schema.subscription)
    .set({
      paystackSubscriptionCode: created.subscription_code,
      paystackEmailToken: created.email_token
        ? seal(deps, created.email_token)
        : null,
      scheduledPlanPriceId: null,
      scheduledSubscriptionCode: null,
      scheduledEmailToken: null,
    })
    .where(eq(schema.subscription.id, sub.id));
  await audit(tx, {
    organizationId: sub.organizationId,
    actorUserId: input.actorUserId,
    action: "billing.downgrade_canceled",
    data: {
      kept: sub.planPriceId,
      dropped: sub.scheduledPlanPriceId,
      from: sub.paystackSubscriptionCode,
      to: created.subscription_code,
    },
  });
}

/** Cancel at period end. Codes and tokens come from our DB, never the
 *  request (PLAN §2.3 #11). Access continues until `current_period_end`. */
export async function cancelSubscription(
  deps: BillingDeps,
  input: { organizationId: string; actor: Actor }
) {
  return transactionWithNotifications(deps, async (tx, scoped) => {
    const sub = await liveSubscription(tx, input.organizationId, {
      lock: true,
    });
    if (!sub?.paystackSubscriptionCode) {
      throw new BillingError("no_subscription", "Nothing to cancel.");
    }
    if (!["active", "trialing", "past_due"].includes(sub.status)) {
      throw new BillingError("invalid_state", "Already cancelled.");
    }
    const token = await emailTokenFor(
      deps,
      sub.paystackSubscriptionCode,
      sub.paystackEmailToken
    );
    if (!token) {
      throw new BillingError("invalid_state", "Missing Paystack email token.");
    }
    // A scheduled downgrade already disabled the current subscription.
    const retired = (await isReplacedCode(tx, sub.paystackSubscriptionCode))
      ?.disabledAt;
    if (!retired) {
      await disableOrConfirmDisabled(deps, sub.paystackSubscriptionCode, token);
    }
    if (sub.scheduledSubscriptionCode) {
      await retireSubscription(
        deps,
        tx,
        sub.organizationId,
        sub.scheduledSubscriptionCode,
        sub.scheduledEmailToken
      );
    }
    const now = deps.now();
    await tx
      .update(schema.subscription)
      .set({
        status: "non_renewing",
        cancelAtPeriodEnd: true,
        canceledAt: now,
        paystackEmailToken: seal(deps, token),
        scheduledPlanPriceId: null,
        scheduledSubscriptionCode: null,
        scheduledEmailToken: null,
      })
      .where(eq(schema.subscription.id, sub.id));
    await audit(tx, {
      organizationId: sub.organizationId,
      actorUserId: input.actor.userId,
      action: "billing.canceled",
      data: { effectiveAt: sub.currentPeriodEnd },
    });
    const endsAt = sub.trialEndsAt ?? sub.currentPeriodEnd;
    await scoped.notify?.({
      type: "subscription_canceled",
      organizationId: sub.organizationId,
      key: `canceled:${sub.id}:${now.toISOString()}`,
      planPriceId: sub.planPriceId,
      accessUntil: endsAt,
    });
    return { endsAt };
  });
}

/**
 * Paystack's answer to disabling a subscription that is already off, or to
 * a code and token that don't match.
 */
function isAlreadyInactive(error: unknown): boolean {
  return (
    error instanceof PaystackError &&
    error.httpStatus < 500 &&
    /not found or already inactive/i.test(error.message)
  );
}

/**
 * Disables a subscription, treating "already inactive" as done once
 * Paystack confirms it won't renew. If it is still active the stored token
 * was stale, so the disable is retried with the current one.
 */
async function disableOrConfirmDisabled(
  deps: BillingDeps,
  code: string,
  token: string
) {
  try {
    await deps.paystack.disableSubscription({ code, token });
    return;
  } catch (error) {
    if (!isAlreadyInactive(error)) {
      throw error;
    }
    const remote = await deps.paystack.fetchSubscription(code);
    if (remote.status !== "active") {
      return;
    }
    if (!remote.email_token || remote.email_token === token) {
      throw error;
    }
    await deps.paystack.disableSubscription({
      code,
      token: remote.email_token,
    });
  }
}

/**
 * Undo a cancellation before the period ends. Paystack can't re-enable a
 * disabled subscription, so this creates a new one on the same plan and saved
 * card, starting when the current period (or trial) ends. The old code is
 * recorded as replaced so its closing webhooks are ignored.
 */
export async function resumeSubscription(
  deps: BillingDeps,
  input: { organizationId: string; actor: Actor }
) {
  return deps.db.transaction(async (tx) => {
    const sub = await liveSubscription(tx, input.organizationId, {
      lock: true,
    });
    const now = deps.now();
    if (
      !(
        sub?.paystackSubscriptionCode &&
        sub.status === "non_renewing" &&
        sub.currentPeriodEnd
      ) ||
      now >= sub.currentPeriodEnd
    ) {
      throw new BillingError("invalid_state", "Nothing to resume.");
    }
    const authorizationCode = unseal(deps, sub.authorizationCode);
    if (!authorizationCode) {
      throw new BillingError(
        "no_card",
        "No saved card to resume with. Choose a plan again when this one ends."
      );
    }
    const row = await planPriceRow(tx, sub.planPriceId);
    const customer = await billingCustomer(tx, sub.organizationId);
    if (!(row?.paystackPlanCode && customer)) {
      throw new BillingError("plan_not_synced", "This plan is not synced.");
    }
    const trialing = Boolean(sub.trialEndsAt && now < sub.trialEndsAt);
    const startDate =
      trialing && sub.trialEndsAt ? sub.trialEndsAt : sub.currentPeriodEnd;

    let created: Awaited<ReturnType<typeof deps.paystack.createSubscription>>;
    try {
      created = await createOrAdoptSubscription(deps, tx, {
        customer: customer.paystackCustomerCode,
        plan: row.paystackPlanCode,
        authorization: authorizationCode,
        start_date: startDate.toISOString(),
      });
    } catch (error) {
      deps.logger.error("resume could not create a subscription", {
        organizationId: sub.organizationId,
        error: String(error),
      });
      throw new BillingError(
        "paystack_error",
        "Paystack couldn't restart the subscription. Try again in a minute."
      );
    }

    await tx
      .insert(schema.replacedSubscription)
      .values({
        paystackSubscriptionCode: sub.paystackSubscriptionCode,
        organizationId: sub.organizationId,
        emailToken: sub.paystackEmailToken,
        disabledAt: sub.canceledAt ?? now,
      })
      .onConflictDoNothing();
    await tx
      .update(schema.subscription)
      .set({
        paystackSubscriptionCode: created.subscription_code,
        paystackEmailToken: created.email_token
          ? seal(deps, created.email_token)
          : null,
        status: trialing ? "trialing" : "active",
        cancelAtPeriodEnd: false,
        canceledAt: null,
      })
      .where(eq(schema.subscription.id, sub.id));
    await audit(tx, {
      organizationId: sub.organizationId,
      actorUserId: input.actor.userId,
      action: "billing.resumed",
      data: {
        from: sub.paystackSubscriptionCode,
        to: created.subscription_code,
      },
    });
  });
}

/** Paystack's hosted page for updating the card on a subscription. */
export async function getManageCardLink(
  deps: BillingDeps,
  organizationId: string
) {
  const sub = await liveSubscription(deps.db, organizationId);
  if (!sub?.paystackSubscriptionCode) {
    throw new BillingError(
      "no_subscription",
      "There's no card on file: the organization is on the Free plan."
    );
  }
  if (sub.status === "non_renewing" || sub.cancelAtPeriodEnd) {
    throw new BillingError(
      "invalid_state",
      "This plan is cancelled. Resume it to update the card."
    );
  }
  const { link } = await deps.paystack.getManageLink(
    sub.paystackSubscriptionCode
  );
  return link;
}

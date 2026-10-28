import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { getPlan, getPlanPrice } from "../catalog";
import { BillingError } from "../errors";
import { type Currency, TOKENIZATION_AMOUNT } from "../money";
import { computeProration } from "../proration";
import type { Actor } from "./checkout";
import {
  audit,
  type BillingDeps,
  billingCustomer,
  liveSubscription,
  newReference,
  planPriceRow,
  seal,
  transactionWithNotifications,
  unseal,
} from "./context";
import { upsertInvoice } from "./invoices";
import {
  emailTokenFor,
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
  | { kind: "downgrade_scheduled"; effectiveAt: Date };

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
      if (sub.planPriceId === target.id) {
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
        targetPlan.rank > currentPlan.rank ||
        (targetPlan.rank === currentPlan.rank &&
          target.interval === "annually" &&
          current.interval === "monthly");

      if (!isUpgrade) {
        if (input.memberCount > targetPlan.limits.members) {
          throw new BillingError(
            "over_member_limit",
            `${targetPlan.name} allows ${targetPlan.limits.members} members; remove ${input.memberCount - targetPlan.limits.members} first.`
          );
        }
        const customer = await billingCustomer(tx, input.organizationId);
        if (!customer) {
          throw new BillingError("no_subscription", "No billing customer");
        }
        const effectiveAt = sub.currentPeriodEnd ?? deps.now();
        const created = await deps.paystack
          .createSubscription({
            customer: customer.paystackCustomerCode,
            plan: row.paystackPlanCode,
            authorization: authorizationCode,
            start_date: effectiveAt.toISOString(),
          })
          .catch(() => {
            throw new BillingError(
              "downgrade_failed",
              "Could not schedule the downgrade. Nothing was changed."
            );
          });
        if (sub.paystackSubscriptionCode) {
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

      // Upgrade. Nothing is owed for unpaid trial time.
      const now = deps.now();
      const proration =
        sub.status === "trialing" ||
        !(sub.currentPeriodStart && sub.currentPeriodEnd)
          ? { charge: 0 }
          : computeProration({
              oldAmount: current.amountSubunit,
              oldInterval: current.interval,
              newAmount: target.amountSubunit,
              newInterval: target.interval,
              periodStart: sub.currentPeriodStart,
              periodEnd: sub.currentPeriodEnd,
              now,
            });
      // Below Paystack's minimum card charge the difference is waived.
      const charge =
        proration.charge >= TOKENIZATION_AMOUNT[sub.currency as Currency]
          ? proration.charge
          : 0;

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
      await tx.insert(schema.paymentIntent).values({
        id: reference,
        organizationId: sub.organizationId,
        kind: "proration",
        planPriceId: target.id,
        amountSubunit: charge,
        currency: sub.currency,
        createdByUserId: input.actor.userId,
        createdAt: deps.now(),
      });
      const customer = await billingCustomer(tx, sub.organizationId);
      const email =
        sub.authorizationEmail ?? customer?.email ?? input.actor.email;
      const metadata = {
        organization_id: sub.organizationId,
        payment_intent_id: reference,
        plan_price_id: target.id,
        kind: "proration",
      };
      const result = await deps.paystack
        .chargeAuthorization({
          email,
          amount: charge,
          currency: sub.currency,
          authorization_code: authorizationCode,
          reference,
          metadata,
        })
        .catch(() => null);

      if (result?.status === "success" && !result.paused) {
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
          await upsertInvoice(tx, {
            organizationId: sub.organizationId,
            subscriptionId: sub.id,
            reference,
            amountSubunit: charge,
            currency: sub.currency,
            status: "void",
            description: "Plan upgrade (refunded)",
          });
          return { failed: error };
        }
        await upsertInvoice(tx, {
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          reference,
          amountSubunit: charge,
          currency: sub.currency,
          status: "paid",
          paidAt: now,
          description: "Plan upgrade (prorated)",
        });
        await notifyChange({
          key: `plan_changed:${reference}`,
          change: "upgrade",
          chargedSubunit: charge,
          effectiveAt: now,
        });
        return { kind: "upgraded", charged: charge };
      }

      if (result?.paused && result.authorization_url) {
        // The bank wants the customer present (2FA). The webhook for this
        // reference completes the upgrade.
        return {
          kind: "checkout_required",
          reference,
          accessCode: "",
          authorizationUrl: result.authorization_url,
          amountSubunit: charge,
        };
      }

      // Card declined: fall back to a checkout for the same amount.
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
    await deps.paystack.disableSubscription({
      code: sub.paystackSubscriptionCode,
      token,
    });
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

/** Undo a cancellation before the period ends. */
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
      !(sub?.paystackSubscriptionCode && sub.status === "non_renewing") ||
      (sub.currentPeriodEnd && now >= sub.currentPeriodEnd)
    ) {
      throw new BillingError("invalid_state", "Nothing to resume.");
    }
    const token = await emailTokenFor(
      deps,
      sub.paystackSubscriptionCode,
      sub.paystackEmailToken
    );
    if (!token) {
      throw new BillingError("invalid_state", "Missing Paystack email token.");
    }
    await deps.paystack.enableSubscription({
      code: sub.paystackSubscriptionCode,
      token,
    });
    await tx
      .update(schema.subscription)
      .set({
        status:
          sub.trialEndsAt && now < sub.trialEndsAt ? "trialing" : "active",
        cancelAtPeriodEnd: false,
        canceledAt: null,
      })
      .where(eq(schema.subscription.id, sub.id));
    await audit(tx, {
      organizationId: sub.organizationId,
      actorUserId: input.actor.userId,
      action: "billing.resumed",
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
    throw new BillingError("no_subscription", "No subscription.");
  }
  const { link } = await deps.paystack.getManageLink(
    sub.paystackSubscriptionCode
  );
  return link;
}

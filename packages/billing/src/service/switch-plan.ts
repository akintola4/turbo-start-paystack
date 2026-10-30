import { type DbOrTx, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { BillingError } from "../errors";
import {
  audit,
  type BillingDeps,
  billingCustomer,
  planPriceRow,
  type SubscriptionRow,
  seal,
  unseal,
} from "./context";
import { createOrAdoptSubscription } from "./paystack-subscription";

/** Email token for a subscription, fetched from Paystack if we never got
 *  the `subscription.create` webhook that carries it. */
export async function emailTokenFor(
  deps: BillingDeps,
  code: string,
  sealed: string | null
): Promise<string | null> {
  const token = unseal(deps, sealed);
  if (token) {
    return token;
  }
  const remote = await deps.paystack.fetchSubscription(code);
  return remote.email_token ?? null;
}

/**
 * Disables a Paystack subscription we are replacing, recording its code first
 * so its later `subscription.not_renew` / `subscription.disable` webhooks are
 * recognised and ignored. A failed disable is retried by reconcile.
 */
export async function retireSubscription(
  deps: BillingDeps,
  tx: DbOrTx,
  organizationId: string,
  code: string,
  sealedToken: string | null
) {
  await tx
    .insert(schema.replacedSubscription)
    .values({
      paystackSubscriptionCode: code,
      organizationId,
      emailToken: sealedToken,
    })
    .onConflictDoNothing();
  try {
    const token = await emailTokenFor(deps, code, sealedToken);
    if (!token) {
      throw new Error("no email token");
    }
    await deps.paystack.disableSubscription({ code, token });
    await tx
      .update(schema.replacedSubscription)
      .set({ disabledAt: deps.now(), emailToken: seal(deps, token) })
      .where(eq(schema.replacedSubscription.paystackSubscriptionCode, code));
  } catch (error) {
    deps.logger.warn(
      "disable of replaced subscription failed; reconcile will retry",
      {
        organizationId,
        code,
        error: String(error),
      }
    );
  }
}

/**
 * Moves an organization to another plan now, keeping its billing date:
 * 1. create the new Paystack subscription starting at the current period end,
 * 2. only then retire the old one.
 * If step 1 fails nothing has changed on Paystack (the caller refunds any
 * proration it took). Plan PLAN §2.3 #10 is the bug this ordering avoids.
 */
export async function switchPlanNow(
  deps: BillingDeps,
  tx: DbOrTx,
  sub: SubscriptionRow,
  input: {
    targetPlanPriceId: string;
    authorizationCode: string;
    actorUserId?: string | null;
    newCard?: Partial<SubscriptionRow>;
    refundReference?: string;
  }
) {
  const row = await planPriceRow(tx, input.targetPlanPriceId);
  const customer = await billingCustomer(tx, sub.organizationId);
  if (!(row?.paystackPlanCode && customer)) {
    throw new BillingError("plan_not_synced", "Target plan is not synced");
  }
  const startDate =
    sub.trialEndsAt && sub.status === "trialing"
      ? sub.trialEndsAt
      : (sub.currentPeriodEnd ?? deps.now());

  let created: Awaited<ReturnType<typeof deps.paystack.createSubscription>>;
  try {
    created = await createOrAdoptSubscription(deps, tx, {
      customer: customer.paystackCustomerCode,
      plan: row.paystackPlanCode,
      authorization: input.authorizationCode,
      start_date: startDate.toISOString(),
    });
  } catch (error) {
    if (input.refundReference) {
      try {
        await deps.paystack.refund({ transaction: input.refundReference });
      } catch (refundError) {
        deps.logger.error("refund after failed upgrade also failed", {
          reference: input.refundReference,
          error: String(refundError),
        });
      }
    }
    await audit(tx, {
      organizationId: sub.organizationId,
      actorUserId: input.actorUserId,
      action: "billing.plan_change_failed",
      data: { to: input.targetPlanPriceId, error: String(error) },
    });
    throw new BillingError(
      "upgrade_failed",
      "Could not create the new subscription. Any proration charge was refunded."
    );
  }

  if (sub.paystackSubscriptionCode) {
    await retireSubscription(
      deps,
      tx,
      sub.organizationId,
      sub.paystackSubscriptionCode,
      sub.paystackEmailToken
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

  await tx
    .update(schema.subscription)
    .set({
      ...input.newCard,
      planPriceId: input.targetPlanPriceId,
      paystackSubscriptionCode: created.subscription_code,
      paystackEmailToken: created.email_token
        ? seal(deps, created.email_token)
        : null,
      scheduledPlanPriceId: null,
      scheduledSubscriptionCode: null,
      scheduledEmailToken: null,
      cancelAtPeriodEnd: false,
      status: sub.status === "non_renewing" ? "active" : sub.status,
    })
    .where(eq(schema.subscription.id, sub.id));

  await audit(tx, {
    organizationId: sub.organizationId,
    actorUserId: input.actorUserId,
    action: "billing.plan_changed",
    data: { from: sub.planPriceId, to: input.targetPlanPriceId },
  });
}

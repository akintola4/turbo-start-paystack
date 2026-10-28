import { type Database, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { getPlan, getPlanPrice } from "../catalog";
import { BillingError } from "../errors";
import { type Currency, TOKENIZATION_AMOUNT } from "../money";
import {
  audit,
  type BillingDeps,
  billingCustomer,
  liveSubscription,
  newReference,
  planPriceRow,
} from "./context";

export type Actor = { userId: string; email: string };

export async function ensureCustomer(
  deps: BillingDeps,
  db: Database,
  organizationId: string,
  email: string,
  currency: Currency
) {
  const existing = await billingCustomer(db, organizationId);
  if (existing) {
    if (existing.currency !== currency) {
      throw new BillingError(
        "currency_locked",
        `This organization is billed in ${existing.currency}.`
      );
    }
    return existing;
  }
  const created = await deps.paystack.createCustomer({
    email,
    metadata: { organization_id: organizationId },
  });
  await db
    .insert(schema.billingCustomer)
    .values({
      organizationId,
      paystackCustomerCode: created.customer_code,
      email: created.email,
      currency,
    })
    .onConflictDoNothing();
  const row = await billingCustomer(db, organizationId);
  if (!row) {
    throw new Error("billing customer was not stored");
  }
  return row;
}

/**
 * Starts a Paystack checkout for a plan price. Everything that matters is
 * decided here on the server: the amount (from the catalog), the plan code,
 * the email (the org's billing email), and the metadata. The browser only
 * ever receives the `access_code` / `authorization_url`. Nothing is granted
 * until a verified charge arrives (PLAN §2.3 #6).
 */
export async function startCheckout(
  deps: BillingDeps,
  input: { organizationId: string; actor: Actor; planPriceId: string }
) {
  const { db } = deps;
  const price = getPlanPrice(input.planPriceId);
  const plan = price && getPlan(price.planKey);
  if (!(price && plan)) {
    throw new BillingError("plan_not_found", "Unknown plan");
  }
  const row = await planPriceRow(db, input.planPriceId);
  if (!(row?.paystackPlanCode && row.active)) {
    throw new BillingError(
      "plan_not_synced",
      "This plan has no Paystack plan code yet. Run `pnpm billing:sync`."
    );
  }
  if (await liveSubscription(db, input.organizationId)) {
    throw new BillingError(
      "already_subscribed",
      "This organization already has a subscription. Change plan instead."
    );
  }
  const customer = await ensureCustomer(
    deps,
    db,
    input.organizationId,
    input.actor.email,
    price.currency
  );

  const [previous] = await db
    .select({ id: schema.subscription.id })
    .from(schema.subscription)
    .where(eq(schema.subscription.organizationId, input.organizationId))
    .limit(1);
  const kind =
    deps.trialMode !== "off" && plan.trialDays > 0 && !previous
      ? "trial"
      : "subscribe";
  const amount =
    kind === "trial"
      ? TOKENIZATION_AMOUNT[price.currency]
      : price.amountSubunit;
  const reference = newReference();

  await db.insert(schema.paymentIntent).values({
    id: reference,
    organizationId: input.organizationId,
    kind,
    planPriceId: price.id,
    amountSubunit: amount,
    currency: price.currency,
    createdByUserId: input.actor.userId,
    createdAt: deps.now(),
  });

  const init = await deps.paystack.initializeTransaction({
    email: customer.email,
    amount,
    currency: price.currency,
    reference,
    callback_url: deps.callbackUrl,
    // Subscriptions renew only on reusable card authorizations.
    channels: ["card"],
    plan: kind === "subscribe" ? row.paystackPlanCode : undefined,
    metadata: {
      organization_id: input.organizationId,
      payment_intent_id: reference,
      plan_price_id: price.id,
      kind,
    },
  });
  await db
    .update(schema.paymentIntent)
    .set({ accessCode: init.access_code })
    .where(eq(schema.paymentIntent.id, reference));
  await audit(db, {
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "billing.checkout_started",
    target: reference,
    data: { planPriceId: price.id, kind, amount },
  });

  return {
    reference,
    kind,
    accessCode: init.access_code,
    authorizationUrl: init.authorization_url,
    amountSubunit: amount,
    currency: price.currency,
  };
}

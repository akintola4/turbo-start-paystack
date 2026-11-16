import { type Database, schema } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

import { getPlan, getPlanPrice } from "../catalog";
import { BillingError, PaystackError } from "../errors";
import { type Currency, TOKENIZATION_AMOUNT } from "../money";
import {
  audit,
  type BillingDeps,
  billingCustomer,
  liveSubscription,
  newReference,
  planPriceRow,
} from "./context";
import {
  availableCustomerEmails,
  emailTakenByAnotherOrg,
  noCustomerEmail,
} from "./customer-email";

/** The signed-in user acting for the organization. `emailVerified` comes
 *  from the session: an unverified address may not be the user's, so it is
 *  never sent to Paystack as the paying customer's email. */
export type Actor = { userId: string; email: string; emailVerified: boolean };

/** `POST /customer`. Paystack customers are unique by email, so for an
 *  address it already knows it answers with that customer; if it refuses
 *  instead, the existing customer is fetched by email and adopted. */
async function createOrAdoptCustomer(
  deps: BillingDeps,
  email: string,
  organizationId: string
) {
  try {
    return await deps.paystack.createCustomer({
      email,
      metadata: { organization_id: organizationId },
    });
  } catch (error) {
    if (!(error instanceof PaystackError && error.httpStatus < 500)) {
      throw error;
    }
    const existing = await deps.paystack.fetchCustomer(email).catch(() => null);
    if (!existing) {
      throw error;
    }
    return existing;
  }
}

/**
 * The organization's own Paystack customer, created at its first checkout.
 * The email is chosen as described in customer-email.ts and then locked,
 * like the currency: it is never changed silently later.
 */
export async function ensureCustomer(
  deps: BillingDeps,
  db: Database,
  organizationId: string,
  actorEmail: string,
  currency: Currency
) {
  let row = await billingCustomer(db, organizationId);
  if (!row) {
    const candidates = await availableCustomerEmails(
      db,
      organizationId,
      actorEmail
    );
    for (const candidate of candidates) {
      // Nobody verified the billing email. If Paystack already has a
      // customer at that address, it may be someone else's, so take the
      // next candidate rather than adopt it.
      if (
        candidate.source === "billing_email" &&
        (await deps.paystack.fetchCustomer(candidate.email).catch(() => null))
      ) {
        continue;
      }
      const created = await createOrAdoptCustomer(
        deps,
        candidate.email,
        organizationId
      );
      // Another organization may have claimed the address since the
      // check above. The lock makes check-and-insert atomic per address.
      const stored = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`paystack-email:${candidate.email}`}))`
        );
        if (await emailTakenByAnotherOrg(tx, organizationId, candidate.email)) {
          return false;
        }
        await tx
          .insert(schema.billingCustomer)
          .values({
            organizationId,
            paystackCustomerCode: created.customer_code,
            email: candidate.email,
            currency,
          })
          .onConflictDoNothing();
        return true;
      });
      if (stored) {
        break;
      }
    }
    row = await billingCustomer(db, organizationId);
    if (!row) {
      throw noCustomerEmail();
    }
  }
  if (row.currency !== currency) {
    throw new BillingError(
      "currency_locked",
      `This organization is billed in ${row.currency}.`
    );
  }
  return row;
}

/**
 * Starts a Paystack checkout for a plan price. Everything that matters is
 * decided here on the server: the amount (from the catalog), the plan code,
 * the email (the organization's own Paystack customer), and the metadata.
 * The browser only ever receives the `access_code` / `authorization_url`.
 * Nothing is granted until a verified charge arrives (PLAN §2.3 #6).
 */
export async function startCheckout(
  deps: BillingDeps,
  input: { organizationId: string; actor: Actor; planPriceId: string }
) {
  const { db } = deps;
  if (!input.actor.emailVerified) {
    throw new BillingError(
      "email_unverified",
      "Verify your email address before starting a checkout."
    );
  }
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

  // If Paystack never created the transaction, the intent must not outlive
  // the failure: a known reference would let a forged charge match it.
  const init = await deps.paystack
    .initializeTransaction({
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
    })
    .catch(async (error: unknown) => {
      await db
        .delete(schema.paymentIntent)
        .where(eq(schema.paymentIntent.id, reference));
      throw error;
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

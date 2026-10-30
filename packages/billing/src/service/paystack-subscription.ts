import { type DbOrTx, schema } from "@workspace/db";
import { inArray, or } from "drizzle-orm";

import { PaystackError } from "../errors";
import { type PaystackSubscription, planCodeOf } from "../paystack/types";
import type { BillingDeps } from "./context";

/** Paystack's answer when the customer already has this plan. */
export function isAlreadyInPlace(error: unknown): boolean {
  return (
    error instanceof PaystackError &&
    error.httpStatus < 500 &&
    /already in place/i.test(error.message)
  );
}

const LIVE_REMOTE = new Set(["active", "non-renewing", "attention"]);

/**
 * `POST /subscription`, made safe to repeat. Paystack refuses a second
 * subscription for the same customer and plan ("This subscription is
 * already in place."). That happens when an earlier attempt created it and
 * our transaction then rolled back, or when the webhook and the callback
 * race. In that case the existing subscription is looked up and adopted,
 * unless it already belongs to one of our rows (another organization paying
 * with the same email, or one we retired), which is a real conflict.
 */
export async function createOrAdoptSubscription(
  deps: BillingDeps,
  tx: DbOrTx,
  input: {
    customer: string;
    plan: string;
    authorization?: string;
    start_date?: string;
  }
): Promise<PaystackSubscription> {
  try {
    return await deps.paystack.createSubscription(input);
  } catch (error) {
    if (!isAlreadyInPlace(error)) {
      throw error;
    }
    const existing = await findAdoptable(deps, tx, input);
    if (!existing) {
      throw error;
    }
    deps.logger.info("adopted an existing Paystack subscription", {
      customer: input.customer,
      plan: input.plan,
      code: existing.subscription_code,
    });
    return existing;
  }
}

async function findAdoptable(
  deps: BillingDeps,
  tx: DbOrTx,
  input: { customer: string; plan: string }
): Promise<PaystackSubscription | undefined> {
  const customer = await deps.paystack.fetchCustomer(input.customer);
  const remote = (
    await deps.paystack.listSubscriptions({ customer: customer.id })
  ).filter(
    (s) =>
      planCodeOf(s.plan) === input.plan && LIVE_REMOTE.has(s.status ?? "active")
  );
  if (remote.length === 0) {
    return;
  }
  const codes = remote.map((s) => s.subscription_code);
  const [claimed, replaced] = await Promise.all([
    tx
      .select({
        code: schema.subscription.paystackSubscriptionCode,
        scheduled: schema.subscription.scheduledSubscriptionCode,
      })
      .from(schema.subscription)
      .where(
        or(
          inArray(schema.subscription.paystackSubscriptionCode, codes),
          inArray(schema.subscription.scheduledSubscriptionCode, codes)
        )
      ),
    tx
      .select({ code: schema.replacedSubscription.paystackSubscriptionCode })
      .from(schema.replacedSubscription)
      .where(
        inArray(schema.replacedSubscription.paystackSubscriptionCode, codes)
      ),
  ]);
  const taken = new Set([
    ...claimed.flatMap((r) => [r.code, r.scheduled]),
    ...replaced.map((r) => r.code),
  ]);
  // The newest one nobody owns.
  const created = (s: PaystackSubscription) =>
    String(s.createdAt ?? s.created_at ?? "");
  return remote
    .filter((s) => !taken.has(s.subscription_code))
    .sort((a, b) => created(b).localeCompare(created(a)))[0];
}

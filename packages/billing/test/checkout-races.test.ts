import { schema } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ingestWebhook } from "../src/webhook/ingest";
import { signPaystackPayload } from "../src/webhook/verify";
import {
  type BillingHarness,
  KEY,
  planCode,
  SECRET,
  setupBilling,
} from "./support";

/*
 * The callback page and the charge.success webhook both apply the same
 * charge, in either order, possibly more than once. Creating the Paystack
 * subscription is the one step with a remote side effect, and Paystack
 * refuses a second one for the same customer and plan ("This subscription
 * is already in place."), which used to 500 the callback.
 */

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
const PLAN = "starter-monthly-ngn";
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
});

async function trialCheckout() {
  const org = await h.createOrg();
  const checkout = await h.billing.startCheckout({ ...org, planPriceId: PLAN });
  const paid = h.pay(checkout.reference);
  const subscriptionCalls = () =>
    h.fake
      .callsTo("POST", "/subscription")
      .filter((c) => c.body.customer === paid.customer.customer_code);
  return { org, checkout, paid, subscriptionCalls };
}

/** A Paystack subscription that exists remotely but not in our database:
 *  what an attempt leaves behind when its transaction rolls back after
 *  `POST /subscription` succeeded. */
async function orphanSubscription(customerCode: string) {
  const res = await h.fake.handle(
    new Request("http://fake/subscription", {
      method: "POST",
      body: JSON.stringify({
        customer: customerCode,
        plan: planCode(PLAN),
        authorization: "AUTH_test0001",
        start_date: "2026-03-15T10:00:00.000Z",
      }),
    })
  );
  const body = (await res.json()) as { data: { subscription_code: string } };
  return body.data.subscription_code;
}

async function intentStatus(reference: string) {
  const [row] = await h.db
    .select({ status: schema.paymentIntent.status })
    .from(schema.paymentIntent)
    .where(eq(schema.paymentIntent.id, reference));
  return row?.status;
}

async function subscriptionRows(organizationId: string) {
  return h.db
    .select()
    .from(schema.subscription)
    .where(eq(schema.subscription.organizationId, organizationId));
}

describe("callback and webhook, in any order", () => {
  it("callback after the webhook", async () => {
    const { org, checkout, paid, subscriptionCalls } = await trialCheckout();
    expect((await h.deliver(paid.charge))?.error).toBeNull();
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(result.paymentStatus).toBe("succeeded");
    expect(result.subscription?.status).toBe("trialing");
    expect(subscriptionCalls()).toHaveLength(1);
    expect(await subscriptionRows(org.organizationId)).toHaveLength(1);
  });

  it("webhook after the callback", async () => {
    const { org, checkout, paid, subscriptionCalls } = await trialCheckout();
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(result.subscription?.status).toBe("trialing");
    const event = await h.deliver(paid.charge);
    expect(event?.error).toBeNull();
    expect(event?.processedAt).not.toBeNull();
    expect(subscriptionCalls()).toHaveLength(1);
    expect(await subscriptionRows(org.organizationId)).toHaveLength(1);
  });

  it("the callback run twice", async () => {
    const { org, checkout, subscriptionCalls } = await trialCheckout();
    const first = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    const second = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(first.paymentStatus).toBe("succeeded");
    expect(second).toEqual(first);
    expect(subscriptionCalls()).toHaveLength(1);
  });
});

describe('Paystack says "This subscription is already in place."', () => {
  it("the callback adopts the existing subscription instead of failing", async () => {
    const { org, checkout, paid, subscriptionCalls } = await trialCheckout();
    const orphan = await orphanSubscription(paid.customer.customer_code);
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(result.paymentStatus).toBe("succeeded");
    expect(result.subscription).toMatchObject({
      status: "trialing",
      paystackSubscriptionCode: orphan,
    });
    expect(result.subscription?.paystackEmailToken).not.toBeNull();
    // The refused create, then nothing more: the card check was refunded.
    expect(subscriptionCalls()).toHaveLength(2);
    expect(h.fake.refunds.at(-1)?.transaction).toBe(checkout.reference);
    // The webhook that follows is a no-op.
    expect((await h.deliver(paid.charge))?.error).toBeNull();
    expect(await subscriptionRows(org.organizationId)).toHaveLength(1);
  });

  it("the webhook adopts it too", async () => {
    const { org, paid } = await trialCheckout();
    const orphan = await orphanSubscription(paid.customer.customer_code);
    const event = await h.deliver(paid.charge);
    expect(event?.error).toBeNull();
    expect(
      (await h.billing.getSubscription(org.organizationId))
        ?.paystackSubscriptionCode
    ).toBe(orphan);
  });

  it("never adopts a subscription another of our rows owns", async () => {
    const { org, checkout, paid } = await trialCheckout();
    const taken = await orphanSubscription(paid.customer.customer_code);
    // Another organization billed to the same Paystack customer has it.
    const other = await h.createOrg();
    await h.db.insert(schema.subscription).values({
      id: "sub_other",
      organizationId: other.organizationId,
      planPriceId: PLAN,
      status: "active",
      currency: "NGN",
      paystackSubscriptionCode: taken,
    });
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    // No crash: the page shows "confirming" and reconcile keeps trying.
    expect(result.paymentStatus).toBe("created");
    expect(result.subscription).toBeNull();
  });

  it("reconcile retries a webhook that failed before the fix and adopts", async () => {
    const { org, paid } = await trialCheckout();
    const orphan = await orphanSubscription(paid.customer.customer_code);
    // Stored, attempted once, failed: as in production.
    const rawBody = JSON.stringify(paid.charge);
    const ingested = await ingestWebhook({
      db: h.db,
      rawBody,
      signature: signPaystackPayload(rawBody, SECRET),
      secretKey: SECRET,
      encryptionKey: KEY,
    });
    if (ingested.status !== 200) {
      throw new Error("not ingested");
    }
    await h.db
      .update(schema.webhookEvent)
      .set({
        attempts: 1,
        error: 'invalid_union at path ["plan"]',
      })
      .where(eq(schema.webhookEvent.id, ingested.eventId));

    const report = await h.billing.reconcile();
    expect(report.eventsRetried).toBeGreaterThanOrEqual(1);
    const [event] = await h.db
      .select()
      .from(schema.webhookEvent)
      .where(eq(schema.webhookEvent.id, ingested.eventId));
    expect(event).toMatchObject({ error: null, attempts: 2 });
    expect(event?.processedAt).not.toBeNull();
    expect(
      (await h.billing.getSubscription(org.organizationId))
        ?.paystackSubscriptionCode
    ).toBe(orphan);
  });
});

describe("the callback never fails for a valid reference", () => {
  it("returns 'created' when Paystack is down, and the webhook finishes", async () => {
    const { org, checkout, paid } = await trialCheckout();
    h.fake.failNext("GET", /^\/transaction\/verify\//, 400, "Bad gateway");
    const result = await h.billing.confirmByReference(
      org.organizationId,
      checkout.reference
    );
    expect(result).toEqual({ paymentStatus: "created", subscription: null });
    await h.deliver(paid.charge);
    expect((await h.billing.getSubscription(org.organizationId))?.status).toBe(
      "trialing"
    );
  });

  it("reconcile does not abandon a paid checkout when Paystack refuses a later step", async () => {
    const { org, checkout } = await trialCheckout();
    h.clock.now = new Date(START.getTime() + 2 * 3_600_000);
    // Only this checkout is old enough for reconcile to verify.
    await h.db
      .update(schema.paymentIntent)
      .set({ createdAt: h.clock.now })
      .where(ne(schema.paymentIntent.id, checkout.reference));
    h.fake.failNext("POST", /^\/subscription$/, 400, "Plan is not active");
    const first = await h.billing.reconcile();
    expect(first.errors.join()).toContain("Plan is not active");
    expect(await intentStatus(checkout.reference)).toBe("created");

    await h.billing.reconcile();
    expect(await intentStatus(checkout.reference)).toBe("succeeded");
    expect((await h.billing.getSubscription(org.organizationId))?.status).toBe(
      "trialing"
    );
  });
});

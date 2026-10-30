import { type Database, schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { eq } from "drizzle-orm";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import { listPlanPrices } from "../src/catalog";
import { createFakePaystack } from "../src/fake-paystack";
import { chargeSuccess, subscriptionCreate } from "../src/fixtures";
import type { InvoicingConfig } from "../src/invoicing";
import { createPaystackClient } from "../src/paystack/client";
import type { BillingNotification } from "../src/service/context";
import { createBillingService } from "../src/service/index";
import { ingestWebhook } from "../src/webhook/ingest";
import { signPaystackPayload } from "../src/webhook/verify";

export const PAYSTACK_BASE = "https://api.paystack.test";
export const SECRET = "sk_test_billing_suite";
export const KEY = "0123456789abcdef".repeat(4);

export const planCode = (planPriceId: string) => `PLN_${planPriceId}`;

const silent = { info() {}, warn() {}, error() {} };

/**
 * Real Postgres (PGlite) + the real billing service + a fake Paystack behind
 * msw. Webhooks go through the same sign → ingest → process path as prod.
 */
export async function setupBilling(
  options: { invoicing?: InvoicingConfig } = {}
) {
  const { db, close } = await createTestDb();
  const clock = { now: new Date("2026-03-01T10:00:00Z") };
  const fake = createFakePaystack({ now: () => clock.now });
  const server = setupServer(
    http.all(`${PAYSTACK_BASE}/*`, async ({ request }) => {
      const url = new URL(request.url);
      const forwarded = new Request(`http://fake${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" ? undefined : await request.text(),
      });
      const res = await fake.handle(forwarded);
      return new HttpResponse(await res.text(), {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    })
  );
  server.listen({ onUnhandledRequest: "error" });

  const notifications: BillingNotification[] = [];
  const billing = createBillingService({
    db,
    paystack: createPaystackClient({
      secretKey: SECRET,
      baseUrl: PAYSTACK_BASE,
      sleep: async () => undefined,
    }),
    encryptionKey: KEY,
    callbackUrl: "http://localhost:3000/billing/callback",
    graceDays: 7,
    now: () => clock.now,
    logger: silent,
    invoicing: options.invoicing,
    notify: async (n) => {
      notifications.push(n);
    },
  });

  for (const price of listPlanPrices()) {
    const code = planCode(price.id);
    await db.insert(schema.planPrice).values({
      id: price.id,
      planKey: price.planKey,
      interval: price.interval,
      currency: price.currency,
      amountSubunit: price.amountSubunit,
      paystackPlanCode: code,
    });
    fake.addPlan({
      plan_code: code,
      name: price.id,
      amount: price.amountSubunit,
      interval: price.interval,
      currency: price.currency,
    });
  }

  let n = 0;
  async function createOrg(opts?: { previouslySubscribed?: boolean }) {
    n += 1;
    const userId = `user_${n}`;
    const organizationId = `org_${n}`;
    const email = `owner${n}@acme.test`;
    await db.insert(schema.user).values({ id: userId, name: "Owner", email });
    await db
      .insert(schema.organization)
      .values({ id: organizationId, name: `Org ${n}`, slug: `org-${n}` });
    await db.insert(schema.member).values({
      id: `member_${n}`,
      organizationId,
      userId,
      role: "owner",
    });
    if (opts?.previouslySubscribed) {
      // An old, ended subscription: the next checkout is not a trial.
      await db.insert(schema.subscription).values({
        id: `old_${n}`,
        organizationId,
        planPriceId: "starter-monthly-ngn",
        status: "canceled",
        currency: "NGN",
      });
    }
    return {
      organizationId,
      actor: { userId, email, emailVerified: true },
    };
  }

  async function deliver(payload: unknown) {
    const rawBody = JSON.stringify(payload);
    const result = await ingestWebhook({
      db,
      rawBody,
      signature: signPaystackPayload(rawBody, SECRET),
      secretKey: SECRET,
      encryptionKey: KEY,
    });
    if (result.status !== 200) {
      throw new Error(`webhook rejected: ${result.status}`);
    }
    await billing.processEvent(result.eventId);
    const [event] = await db
      .select()
      .from(schema.webhookEvent)
      .where(eq(schema.webhookEvent.id, result.eventId));
    return event;
  }

  /** Customer pays the checkout; returns both webhook payloads. */
  function pay(reference: string) {
    const { transaction, subscription } = fake.pay(reference);
    const tx = fake.transactions.get(reference);
    if (!tx) {
      throw new Error("no tx");
    }
    const customer = { customer_code: tx.customer_code, email: tx.email };
    const charge = chargeSuccess({
      reference,
      amount: transaction.amount,
      currency: transaction.currency,
      customer,
      metadata: tx.metadata,
      planCode: tx.plan,
      authorization: tx.authorization ?? undefined,
      paidAt: clock.now.toISOString(),
    });
    const created = subscription
      ? subscriptionCreate({
          subscriptionCode: subscription.subscription_code,
          emailToken: subscription.email_token,
          planCode: subscription.plan,
          amount: transaction.amount,
          customer,
          nextPaymentDate: subscription.next_payment_date,
        })
      : undefined;
    return { charge, created, customer, subscription };
  }

  async function subscribe(planPriceId = "pro-monthly-ngn") {
    const org = await createOrg({ previouslySubscribed: true });
    const checkout = await billing.startCheckout({ ...org, planPriceId });
    const paid = pay(checkout.reference);
    await deliver(paid.charge);
    if (paid.created) {
      await deliver(paid.created);
    }
    const sub = await billing.getSubscription(org.organizationId);
    if (!sub) {
      throw new Error("not subscribed");
    }
    return { ...org, checkout, paid, sub };
  }

  return {
    db: db as Database,
    fake,
    billing,
    clock,
    notifications,
    createOrg,
    deliver,
    pay,
    subscribe,
    async close() {
      server.close();
      await close();
    },
  };
}

export type BillingHarness = Awaited<ReturnType<typeof setupBilling>>;

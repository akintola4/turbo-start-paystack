import { schema } from "@workspace/db";
import { createPgTestDb } from "@workspace/db/testing";
import { isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listPlanPrices } from "../src/catalog";
import { createFakePaystack } from "../src/fake-paystack";
import { chargeSuccess, subscriptionCreate } from "../src/fixtures";
import { createPaystackClient } from "../src/paystack/client";
import { createBillingService } from "../src/service/index";
import { ingestWebhook } from "../src/webhook/ingest";
import { signPaystackPayload } from "../src/webhook/verify";

// Needs a real Postgres (CI provides one). PGlite has a single connection,
// so it cannot reproduce two webhooks being processed at the same time.
const url = process.env.TEST_DATABASE_URL;
const SECRET = "sk_test_concurrency";

describe.skipIf(!url)("concurrent webhook processing on real Postgres", () => {
  let ctx: Awaited<ReturnType<typeof createPgTestDb>>;
  const fake = createFakePaystack();
  let billing: ReturnType<typeof createBillingService>;

  beforeAll(async () => {
    ctx = await createPgTestDb(url ?? "");
    billing = createBillingService({
      db: ctx.db,
      paystack: createPaystackClient({
        secretKey: SECRET,
        baseUrl: "http://fake",
        fetch: (input, init) => fake.handle(new Request(input, init)),
      }),
      encryptionKey: "c".repeat(64),
      callbackUrl: "http://localhost/billing/callback",
      graceDays: 7,
      trialMode: "off",
      logger: { info() {}, warn() {}, error() {} },
    });
    for (const price of listPlanPrices()) {
      await ctx.db
        .insert(schema.planPrice)
        .values({ ...price, paystackPlanCode: `PLN_${price.id}` });
      fake.addPlan({
        plan_code: `PLN_${price.id}`,
        name: price.id,
        amount: price.amountSubunit,
        interval: price.interval,
        currency: price.currency,
      });
    }
  });
  afterAll(async () => ctx?.close());

  async function ingest(payload: unknown) {
    const raw = JSON.stringify(payload);
    const res = await ingestWebhook({
      db: ctx.db,
      rawBody: raw,
      signature: signPaystackPayload(raw, SECRET),
      secretKey: SECRET,
      encryptionKey: "c".repeat(64),
    });
    if (res.status !== 200) {
      throw new Error("rejected");
    }
    return res.eventId;
  }

  it("attaches the subscription code on the first pass when both events race", async () => {
    const orgs = 15;
    for (let i = 0; i < orgs; i++) {
      const userId = `u${i}`;
      const organizationId = `o${i}`;
      await ctx.db
        .insert(schema.user)
        .values({ id: userId, name: "x", email: `o${i}@race.test` });
      await ctx.db
        .insert(schema.organization)
        .values({ id: organizationId, name: "x", slug: `race-${i}` });
      const checkout = await billing.startCheckout({
        organizationId,
        actor: { userId, email: `o${i}@race.test`, emailVerified: true },
        planPriceId: "pro-monthly-ngn",
      });
      const { transaction, subscription } = fake.pay(checkout.reference);
      const tx = fake.transactions.get(checkout.reference);
      const customer = {
        customer_code: tx?.customer_code ?? "",
        email: tx?.email ?? "",
      };
      const ids = [
        await ingest(
          chargeSuccess({
            reference: checkout.reference,
            amount: transaction.amount,
            currency: "NGN",
            customer,
            metadata: tx?.metadata,
            planCode: tx?.plan,
          })
        ),
        await ingest(
          subscriptionCreate({
            subscriptionCode: subscription?.subscription_code ?? "",
            emailToken: subscription?.email_token ?? "",
            planCode: tx?.plan ?? "",
            amount: transaction.amount,
            customer,
            nextPaymentDate: subscription?.next_payment_date ?? "",
          })
        ),
      ];
      // Process both at the same time, the way two after() callbacks would.
      const outcomes = await Promise.all(
        ids.map((id) => billing.processEvent(id))
      );
      expect(outcomes.every((o) => !o.retry)).toBe(true);
    }
    const unprocessed = await ctx.db
      .select()
      .from(schema.webhookEvent)
      .where(isNull(schema.webhookEvent.processedAt));
    expect(unprocessed).toEqual([]);
    const subs = await ctx.db.select().from(schema.subscription);
    expect(subs).toHaveLength(orgs);
    expect(
      subs.every((s) => s.status === "active" && s.paystackSubscriptionCode)
    ).toBe(true);
  });
});

import { createAuth } from "@workspace/auth/server";
import {
  type BillingNotification,
  createBillingService,
  createPaystackClient,
  listPlanPrices,
  signPaystackPayload,
} from "@workspace/billing";
import { createFakePaystack } from "@workspace/billing/fake";
import { chargeSuccess, subscriptionCreate } from "@workspace/billing/fixtures";
import {
  createWebhookSimulator,
  SimulateError,
} from "@workspace/billing/simulate";
import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { createMailer, type DevOutboxEntry } from "@workspace/email";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlePaystackWebhook } from "../src/server/billing-routes";
import {
  type DevDeps,
  devToolsEnabled,
  handleDevOutbox,
  handleDevOutboxEmail,
  handleDevSimulate,
  isLocalMockUrl,
  type MockClient,
} from "../src/server/dev-billing";

const SECRET = "sk_test_local_mock";

async function setup(trialMode: "card" | "off") {
  const { db, close } = await createTestDb();
  const fake = createFakePaystack();
  const notifications: BillingNotification[] = [];
  const billing = createBillingService({
    db,
    paystack: createPaystackClient({
      secretKey: SECRET,
      baseUrl: "http://paystack.fake",
      fetch: (input, init) => fake.handle(new Request(input, init)),
    }),
    encryptionKey: "e".repeat(64),
    callbackUrl: "http://localhost:3000/billing/callback",
    graceDays: 7,
    trialMode,
    logger: { info() {}, warn() {}, error() {} },
    notify: async (n) => {
      notifications.push(n);
    },
  });
  const authService = createAuth({
    db,
    secret: "dev-billing-test-secret-dev-billing-test",
    baseURL: "http://localhost:3000",
    mailer: createMailer({
      appUrl: "http://localhost:3000",
      send: async () => undefined,
    }),
  });
  for (const price of listPlanPrices()) {
    await db.insert(schema.planPrice).values({
      ...price,
      paystackPlanCode: `PLN_${price.id}`,
    });
    fake.addPlan({
      plan_code: `PLN_${price.id}`,
      name: price.id,
      amount: price.amountSubunit,
      interval: price.interval,
      currency: price.currency,
    });
  }

  // The mock's delivery, in-process: the real webhook route, with its
  // after-response processing awaited before the "HTTP" answer returns.
  const simulator = createWebhookSimulator({
    fake,
    secretKey: SECRET,
    gapMs: 0,
    deliver: async (body, signature) => {
      const tasks: Promise<unknown>[] = [];
      const res = await handlePaystackWebhook(
        { db, billing },
        {
          request: new Request("http://localhost/api/webhooks/paystack", {
            method: "POST",
            body,
            headers: signature ? { "x-paystack-signature": signature } : {},
          }),
          secretKey: SECRET,
          enforceIpAllowlist: false,
          schedule: (task) => {
            tasks.push(task());
          },
        }
      );
      await Promise.all(tasks);
      return { status: res.status, response: await res.json() };
    },
  });
  const mock: MockClient = async ({ action, subscriptionCode }) => {
    try {
      return {
        ok: true,
        deliveries: await simulator.run(action, subscriptionCode),
      };
    } catch (error) {
      if (error instanceof SimulateError) {
        return {
          ok: false,
          status: 409,
          error: error.code,
          message: error.message,
        };
      }
      throw error;
    }
  };
  const outbox: DevOutboxEntry[] = [
    {
      id: "e1",
      to: "ada@kola.test",
      subject: "Payment failed",
      text: "Update your card",
      html: "<p>Update your card</p>",
      sentAt: new Date().toISOString(),
    },
  ];
  const deps: DevDeps = {
    db,
    authService,
    billing,
    enabled: true,
    mock,
    outbox: () => outbox,
    waitMs: 500,
  };
  return { db, close, fake, billing, authService, deps, notifications };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

async function signUp(ctx: Ctx, email: string) {
  const { auth } = ctx.authService;
  await auth.api.signUpEmail({
    body: { email, password: "correct-horse-battery", name: email },
  });
  const res = await auth.api.signInEmail({
    body: { email, password: "correct-horse-battery" },
    asResponse: true,
  });
  return new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });
}

async function ownerWithOrg(ctx: Ctx, slug: string) {
  const headers = await signUp(ctx, `owner@${slug}.test`);
  const org = await ctx.authService.auth.api.createOrganization({
    headers,
    body: { name: slug, slug },
  });
  return { headers, orgId: org?.id ?? "" };
}

/** Checkout through the fake, with the mock's signed webhooks. */
async function subscribe(
  ctx: Ctx,
  orgId: string,
  email: string,
  planPriceId: string
) {
  const [user] = await ctx.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email));
  const checkout = await ctx.billing.startCheckout({
    organizationId: orgId,
    actor: { userId: user?.id ?? "", email },
    planPriceId,
  });
  const { transaction, subscription } = ctx.fake.pay(checkout.reference);
  const tx = ctx.fake.transactions.get(checkout.reference);
  const customer = { customer_code: tx?.customer_code ?? "", email };
  const payloads: unknown[] = [
    chargeSuccess({
      reference: checkout.reference,
      amount: transaction.amount,
      currency: transaction.currency,
      customer,
      metadata: tx?.metadata,
      planCode: tx?.plan,
    }),
  ];
  if (subscription) {
    payloads.push(
      subscriptionCreate({
        subscriptionCode: subscription.subscription_code,
        emailToken: subscription.email_token,
        planCode: subscription.plan,
        amount: transaction.amount,
        customer,
        nextPaymentDate: subscription.next_payment_date,
      })
    );
  }
  for (const payload of payloads) {
    const body = JSON.stringify(payload);
    const tasks: Promise<unknown>[] = [];
    await handlePaystackWebhook(ctx, {
      request: new Request("http://localhost/api/webhooks/paystack", {
        method: "POST",
        body,
        headers: { "x-paystack-signature": signPaystackPayload(body, SECRET) },
      }),
      secretKey: SECRET,
      enforceIpAllowlist: false,
      schedule: (task) => {
        tasks.push(task());
      },
    });
    await Promise.all(tasks);
  }
}

const simulate = async (
  ctx: Ctx,
  headers: Headers,
  orgId: string,
  action: string,
  deps: DevDeps = ctx.deps
) => {
  const res = await handleDevSimulate(deps, {
    headers,
    organizationId: orgId,
    body: { action },
    contentType: "application/json",
  });
  return {
    status: res.status,
    body: (await res.json()) as {
      log?: { event: string; status: number | null; outcome: string }[];
      status?: string | null;
      error?: string;
    },
  };
};

const subscriptionOf = async (ctx: Ctx, orgId: string) => {
  const sub = await ctx.billing.getSubscription(orgId);
  if (!sub) {
    throw new Error("no subscription");
  }
  return sub;
};

describe("dev tools guard", () => {
  it("is on only in development with a local mock and a test key", () => {
    const local = {
      NODE_ENV: "development",
      PAYSTACK_API_URL: "http://localhost:4010",
      PAYSTACK_SECRET_KEY: "sk_test_local_mock",
    };
    expect(devToolsEnabled(local)).toBe(true);
    expect(
      devToolsEnabled({ ...local, PAYSTACK_API_URL: "http://127.0.0.1:4011" })
    ).toBe(true);
    expect(devToolsEnabled({ ...local, NODE_ENV: "production" })).toBe(false);
    expect(
      devToolsEnabled({ ...local, PAYSTACK_API_URL: "https://api.paystack.co" })
    ).toBe(false);
    expect(
      devToolsEnabled({ ...local, PAYSTACK_SECRET_KEY: "sk_live_abc" })
    ).toBe(false);
    expect(devToolsEnabled({ ...local, PAYSTACK_API_URL: undefined })).toBe(
      false
    );
  });

  it("treats only plain-http loopback hosts as the mock", () => {
    expect(isLocalMockUrl("http://localhost:4010")).toBe(true);
    expect(isLocalMockUrl("http://[::1]:4010")).toBe(true);
    expect(isLocalMockUrl("https://api.paystack.co")).toBe(false);
    expect(isLocalMockUrl("http://localhost.evil.test:4010")).toBe(false);
    expect(isLocalMockUrl("http://10.0.0.5:4010")).toBe(false);
    expect(isLocalMockUrl("not a url")).toBe(false);
  });
});

describe("dev routes", () => {
  let ctx: Ctx;
  let owner: Headers;
  let orgId: string;

  beforeAll(async () => {
    ctx = await setup("off");
    ({ headers: owner, orgId } = await ownerWithOrg(ctx, "kola"));
  });
  afterAll(async () => ctx.close());

  it("answer 404 when dev tools are off, even for the owner", async () => {
    const off = { ...ctx.deps, enabled: false };
    expect((await simulate(ctx, owner, orgId, "renew", off)).status).toBe(404);
    const list = await handleDevOutbox(off, {
      headers: owner,
      organizationId: orgId,
    });
    expect(list.status).toBe(404);
    const email = await handleDevOutboxEmail(off, {
      headers: owner,
      organizationId: orgId,
      id: "e1",
    });
    expect(email.status).toBe(404);
  });

  it("need a session and a role that manages billing", async () => {
    expect((await simulate(ctx, new Headers(), orgId, "renew")).status).toBe(
      401
    );
    const member = await signUp(ctx, "member@kola.test");
    const [user] = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "member@kola.test"));
    await ctx.db.insert(schema.member).values({
      id: "m_member",
      organizationId: orgId,
      userId: user?.id ?? "",
      role: "admin",
    });
    expect((await simulate(ctx, member, orgId, "renew")).status).toBe(403);
    const outbox = await handleDevOutbox(ctx.deps, {
      headers: member,
      organizationId: orgId,
    });
    expect(outbox.status).toBe(403);
  });

  it("reject bodies other than a known action", async () => {
    const res = await handleDevSimulate(ctx.deps, {
      headers: owner,
      organizationId: orgId,
      body: { action: "renew", status: "active" },
      contentType: "application/json",
    });
    expect(res.status).toBe(400);
    const text = await handleDevSimulate(ctx.deps, {
      headers: owner,
      organizationId: orgId,
      body: { action: "renew" },
      contentType: "text/plain",
    });
    expect(text.status).toBe(415);
  });

  it("explain that there is nothing to simulate before a subscription", async () => {
    const { status, body } = await simulate(ctx, owner, orgId, "renew");
    expect(status).toBe(409);
    expect(body.error).toBe("no_subscription");
  });

  it("list the outbox newest first and serve one email's HTML", async () => {
    const list = await handleDevOutbox(ctx.deps, {
      headers: owner,
      organizationId: orgId,
    });
    expect(await list.json()).toEqual({
      emails: [
        expect.objectContaining({ id: "e1", subject: "Payment failed" }),
      ],
    });
    const email = await handleDevOutboxEmail(ctx.deps, {
      headers: owner,
      organizationId: orgId,
      id: "e1",
    });
    expect(email.headers.get("content-type")).toMatch(/text\/html/);
    expect(await email.text()).toContain("Update your card");
  });
});

describe("simulated lifecycle drives state through webhooks", () => {
  let ctx: Ctx;
  let owner: Headers;
  let orgId: string;

  beforeAll(async () => {
    ctx = await setup("off");
    ({ headers: owner, orgId } = await ownerWithOrg(ctx, "kola"));
    await subscribe(ctx, orgId, "owner@kola.test", "pro-monthly-ngn");
  });
  afterAll(async () => ctx.close());

  it("renews: the period moves on and a paid invoice appears", async () => {
    const before = await subscriptionOf(ctx, orgId);
    expect(before.status).toBe("active");
    const { status, body } = await simulate(ctx, owner, orgId, "renew");
    expect(status).toBe(200);
    expect(body.log?.map((e) => [e.event, e.status, e.outcome])).toEqual([
      ["charge.success", 200, "processed"],
      ["invoice.update", 200, "processed"],
      ["reconcile", null, "nothing to do"],
    ]);
    const after = await subscriptionOf(ctx, orgId);
    expect(after.status).toBe("active");
    expect(after.currentPeriodEnd?.getTime()).toBeGreaterThan(
      before.currentPeriodEnd?.getTime() ?? 0
    );
    const invoices = await ctx.billing.listInvoices(orgId);
    expect(invoices.filter((i) => i.status === "paid")).toHaveLength(2);
  });

  it("fails a renewal: past due with a grace period and the email", async () => {
    const { body } = await simulate(ctx, owner, orgId, "fail");
    expect(body.status).toBe("past_due");
    const sub = await subscriptionOf(ctx, orgId);
    expect(sub.graceUntil).not.toBeNull();
    expect(ctx.notifications.some((n) => n.type === "past_due")).toBe(true);
  });

  it("recovers: back to active, and the failed invoice is paid", async () => {
    const { body } = await simulate(ctx, owner, orgId, "recover");
    expect(body.status).toBe("active");
    const sub = await subscriptionOf(ctx, orgId);
    expect(sub.graceUntil).toBeNull();
    const invoices = await ctx.billing.listInvoices(orgId);
    expect(invoices.some((i) => i.status === "failed")).toBe(false);
    expect(invoices.filter((i) => i.status === "paid")).toHaveLength(3);
    // The recovered renewal is paid on its simulated due date, labelled,
    // and sorted with the others (the bug: wall-clock date, no label).
    const renewals = invoices.filter((i) => i.paystackInvoiceCode);
    for (const inv of renewals) {
      expect(inv.paidAt).toEqual(inv.periodStart);
      expect(inv.description).toBe("Renewal");
    }
    const shown = invoices.map((i) => (i.paidAt ?? i.createdAt).getTime());
    expect(shown).toEqual([...shown].sort((a, b) => b - a));
  });

  it("refuses to recover what is not past due", async () => {
    const { status, body } = await simulate(ctx, owner, orgId, "recover");
    expect(status).toBe(409);
    expect(body.error).toBe("nothing_to_recover");
  });

  it("ignores a duplicate delivery", async () => {
    const before = await subscriptionOf(ctx, orgId);
    const events = await ctx.db.select().from(schema.webhookEvent);
    const { body } = await simulate(ctx, owner, orgId, "duplicate");
    expect(body.log?.[0]).toMatchObject({
      status: 200,
      outcome: "ignored: duplicate",
    });
    expect(await ctx.db.select().from(schema.webhookEvent)).toHaveLength(
      events.length
    );
    expect(await subscriptionOf(ctx, orgId)).toEqual(before);
  });

  it("rejects a forged webhook with 401 and stores nothing", async () => {
    const events = await ctx.db.select().from(schema.webhookEvent);
    const invoices = await ctx.billing.listInvoices(orgId);
    const { body } = await simulate(ctx, owner, orgId, "forged");
    expect(body.log?.[0]).toMatchObject({
      event: "charge.success",
      status: 401,
      outcome: "rejected: bad_signature",
    });
    expect(await ctx.db.select().from(schema.webhookEvent)).toHaveLength(
      events.length
    );
    expect(await ctx.billing.listInvoices(orgId)).toHaveLength(invoices.length);
  });
});

describe("simulated trial end", () => {
  let ctx: Ctx;

  beforeAll(async () => {
    ctx = await setup("card");
  });
  afterAll(async () => ctx.close());

  it("sends the trial-ending reminder, then converts on the first charge", async () => {
    const { headers, orgId } = await ownerWithOrg(ctx, "trial");
    await subscribe(ctx, orgId, "owner@trial.test", "starter-monthly-ngn");
    const trialing = await subscriptionOf(ctx, orgId);
    expect(trialing.status).toBe("trialing");

    const { status, body } = await simulate(ctx, headers, orgId, "end-trial");
    expect(status).toBe(200);
    expect(body.log?.[0]).toMatchObject({
      event: "reconcile: trial reminder",
      outcome: "trial-ending email sent",
    });
    expect(body.status).toBe("active");
    expect(ctx.notifications.map((n) => n.type)).toEqual(
      expect.arrayContaining(["trial_ending", "payment_succeeded"])
    );
    const active = await subscriptionOf(ctx, orgId);
    expect(active.currentPeriodEnd?.getTime()).toBeGreaterThan(
      trialing.trialEndsAt?.getTime() ?? 0
    );

    const again = await simulate(ctx, headers, orgId, "end-trial");
    expect(again.status).toBe(409);
  });
});

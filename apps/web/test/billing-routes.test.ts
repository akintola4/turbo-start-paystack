import { createAuth } from "@workspace/auth/server";
import {
  createBillingService,
  createPaystackClient,
  listPlanPrices,
  signPaystackPayload,
} from "@workspace/billing";
import { createFakePaystack } from "@workspace/billing/fake";
import { chargeSuccess, subscriptionCreate } from "@workspace/billing/fixtures";
import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { createMailer } from "@workspace/email";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  handleBillingAction,
  handlePaystackWebhook,
  isAuthorizedCron,
  readBodyWithin,
  trustedClientIp,
  WEBHOOK_MAX_BYTES,
} from "../src/server/billing-routes";

const SECRET = "sk_test_routes";
const KEY = "f".repeat(64);
let ctx: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const { db, close } = await createTestDb();
  const fake = createFakePaystack();
  const paystack = createPaystackClient({
    secretKey: SECRET,
    baseUrl: "http://paystack.fake",
    fetch: (input, init) => fake.handle(new Request(input, init)),
  });
  const billing = createBillingService({
    db,
    paystack,
    encryptionKey: KEY,
    callbackUrl: "http://localhost:3000/billing/callback",
    graceDays: 7,
    logger: { info() {}, warn() {}, error() {} },
  });
  const authService = createAuth({
    db,
    secret: "routes-test-secret-routes-test-secret",
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
  return { db, close, fake, billing, authService };
}

async function signUp(email: string) {
  const { auth } = ctx.authService;
  await auth.api.signUpEmail({
    body: { email, password: "correct-horse-battery", name: email },
  });
  // Sign-in needs a verified email.
  await ctx.db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.email, email));
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

async function addMember(orgId: string, email: string, role: string) {
  const headers = await signUp(email);
  const users = await ctx.db.select().from(schema.user);
  const target = users.find((u) => u.email === email);
  if (!target) {
    throw new Error(`no user ${email}`);
  }
  // Direct insert keeps these tests about billing routes, not invitations
  // (invitations are covered in packages/auth).
  await ctx.db.insert(schema.member).values({
    id: `m_${email}`,
    organizationId: orgId,
    userId: target.id,
    role,
  });
  return headers;
}

let owner: Headers;
let orgId: string;
let otherOrgId: string;
let otherOwner: Headers;

beforeAll(async () => {
  ctx = await setup();
  owner = await signUp("owner@acme.test");
  const org = await ctx.authService.auth.api.createOrganization({
    headers: owner,
    body: { name: "Acme", slug: "acme" },
  });
  orgId = org?.id ?? "";
  otherOwner = await signUp("owner@globex.test");
  const other = await ctx.authService.auth.api.createOrganization({
    headers: otherOwner,
    body: { name: "Globex", slug: "globex" },
  });
  otherOrgId = other?.id ?? "";
});
afterAll(async () => ctx.close());

const call = (
  headers: Headers,
  action: string,
  body: unknown = {},
  organizationId = orgId,
  contentType: string | null = "application/json"
) =>
  handleBillingAction(ctx, {
    headers,
    organizationId,
    action,
    body,
    contentType,
  });

describe("billing routes: authentication and authorization", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await call(new Headers(), "checkout", {
      planPriceId: "pro-monthly-ngn",
    });
    expect(res.status).toBe(401);
  });

  it("rejects a plain member with 403 (role-denied)", async () => {
    const member = await addMember(orgId, "member@acme.test", "member");
    const res = await call(member, "checkout", {
      planPriceId: "pro-monthly-ngn",
    });
    expect(res.status).toBe(403);
    expect((await call(member, "status")).status).toBe(403);
    expect((await call(member, "cancel")).status).toBe(403);
  });

  it("rejects an admin from spending money but lets them view", async () => {
    const admin = await addMember(orgId, "admin@acme.test", "admin");
    expect(
      (await call(admin, "checkout", { planPriceId: "pro-monthly-ngn" })).status
    ).toBe(403);
    expect((await call(admin, "status")).status).toBe(200);
  });

  it("rejects acting on another organization (PLAN §2.3 #14)", async () => {
    const res = await call(
      owner,
      "checkout",
      { planPriceId: "pro-monthly-ngn" },
      otherOrgId
    );
    expect(res.status).toBe(403);
    expect((await call(otherOwner, "status", {}, orgId)).status).toBe(403);
  });

  it("rejects bodies that try to set status, amount or codes (PLAN §2.3 #1/#2/#11)", async () => {
    const forged = await call(owner, "checkout", {
      planPriceId: "pro-monthly-ngn",
      amount: 100,
      status: "active",
    });
    expect(forged.status).toBe(400);
    const cancel = await call(owner, "cancel", {
      subscriptionCode: "SUB_x",
      emailToken: "tok",
    });
    expect(cancel.status).toBe(400);
  });

  it("requires JSON for mutations (CSRF defence in depth)", async () => {
    const res = await call(owner, "cancel", {}, orgId, "text/plain");
    expect(res.status).toBe(415);
  });

  it("lets the billing role start a checkout", async () => {
    const billingUser = await addMember(orgId, "billing@acme.test", "billing");
    const res = await call(billingUser, "checkout", {
      planPriceId: "starter-monthly-ngn",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ kind: "trial" });
    expect(body.accessCode).toBeTruthy();
  });

  it("refuses checkout while the caller's email is unverified (audit #13)", async () => {
    const lapsed = await addMember(orgId, "lapsed@acme.test", "billing");
    await ctx.db
      .update(schema.user)
      .set({ emailVerified: false })
      .where(eq(schema.user.email, "lapsed@acme.test"));
    const res = await call(lapsed, "checkout", {
      planPriceId: "starter-monthly-ngn",
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "email_unverified" });
  });

  it("returns 404 for unknown actions", async () => {
    expect((await call(owner, "refund-everything")).status).toBe(404);
  });
});

describe("webhook route", () => {
  const request = (raw: string, signature: string | null) =>
    new Request("http://localhost/api/webhooks/paystack", {
      method: "POST",
      body: raw,
      headers: signature ? { "x-paystack-signature": signature } : {},
    });

  it("413s a body over 1 MB before verifying or storing it (audit #9)", async () => {
    const big = JSON.stringify({
      event: "charge.success",
      data: { pad: "x".repeat(WEBHOOK_MAX_BYTES) },
    });
    const tasks: (() => Promise<unknown>)[] = [];
    const res = await handlePaystackWebhook(ctx, {
      request: request(big, signPaystackPayload(big, SECRET)),
      secretKey: SECRET,
      encryptionKey: KEY,
      enforceIpAllowlist: false,
      schedule: (t) => tasks.push(t),
    });
    expect(res.status).toBe(413);
    expect(tasks).toHaveLength(0);
    // Chunked, with no Content-Length to go by.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 20; i++) {
          controller.enqueue(encoder.encode("y".repeat(64 * 1024)));
        }
        controller.close();
      },
    });
    expect(
      await readBodyWithin(
        new Request("http://localhost/", {
          method: "POST",
          body: stream,
          duplex: "half",
        } as RequestInit),
        WEBHOOK_MAX_BYTES
      )
    ).toBeNull();
  });

  it("checks the allow-list against the proxy's client IP, not the first forwarded hop (audit #9)", async () => {
    const raw = JSON.stringify({ event: "charge.success", data: { n: 9 } });
    const send = (headers: Record<string, string>, clientIpHeader?: string) =>
      handlePaystackWebhook(ctx, {
        request: new Request("http://localhost/api/webhooks/paystack", {
          method: "POST",
          body: raw,
          headers: {
            "x-paystack-signature": signPaystackPayload(raw, SECRET),
            ...headers,
          },
        }),
        secretKey: SECRET,
        encryptionKey: KEY,
        enforceIpAllowlist: true,
        clientIpHeader,
        schedule: () => undefined,
      });
    // A forged first hop with Paystack's IP, appended to by the real proxy.
    expect(
      (await send({ "x-forwarded-for": "52.31.139.75, 203.0.113.9" })).status
    ).toBe(401);
    expect(
      (await send({ "x-forwarded-for": "203.0.113.9, 52.31.139.75" })).status
    ).toBe(200);
    // On Vercel the platform header wins over anything in x-forwarded-for.
    expect(
      (
        await send(
          {
            "x-forwarded-for": "52.31.139.75",
            "x-vercel-forwarded-for": "203.0.113.9",
          },
          "x-vercel-forwarded-for"
        )
      ).status
    ).toBe(401);
    expect(
      trustedClientIp(
        new Headers({ "x-real-ip": " 52.31.139.75 " }),
        "x-real-ip"
      )
    ).toBe("52.31.139.75");
    expect(trustedClientIp(new Headers(), "x-forwarded-for")).toBeNull();
  });

  it("401s an unsigned or badly signed body", async () => {
    const raw = JSON.stringify({ event: "charge.success", data: {} });
    const tasks: (() => Promise<unknown>)[] = [];
    const schedule = (t: () => Promise<unknown>) => tasks.push(t);
    for (const sig of [
      null,
      "deadbeef",
      signPaystackPayload(raw, "sk_test_wrong"),
    ]) {
      const res = await handlePaystackWebhook(ctx, {
        request: request(raw, sig),
        secretKey: SECRET,
        encryptionKey: KEY,
        enforceIpAllowlist: false,
        schedule,
      });
      expect(res.status).toBe(401);
    }
    expect(tasks).toHaveLength(0);
  });

  it("acknowledges, then processes, and activates the subscription; status hides secrets", async () => {
    const org = await ctx.authService.auth.api.createOrganization({
      headers: owner,
      body: { name: "Initech", slug: "initech" },
    });
    const initech = org?.id ?? "";
    await ctx.db.insert(schema.subscription).values({
      id: "old_initech",
      organizationId: initech,
      planPriceId: "starter-monthly-ngn",
      status: "canceled",
      currency: "NGN",
    });
    const checkoutRes = await call(
      owner,
      "checkout",
      { planPriceId: "pro-monthly-ngn" },
      initech
    );
    const checkout = await checkoutRes.json();
    expect(checkout.kind).toBe("subscribe");

    const { transaction, subscription } = ctx.fake.pay(checkout.reference);
    const tx = ctx.fake.transactions.get(checkout.reference);
    const customer = {
      customer_code: tx?.customer_code ?? "",
      email: tx?.email ?? "",
    };
    const events = [
      chargeSuccess({
        reference: checkout.reference,
        amount: transaction.amount,
        currency: "NGN",
        customer,
        metadata: tx?.metadata,
        planCode: tx?.plan,
      }),
      subscriptionCreate({
        subscriptionCode: subscription?.subscription_code ?? "",
        emailToken: subscription?.email_token ?? "",
        planCode: tx?.plan ?? "",
        amount: transaction.amount,
        customer,
        nextPaymentDate: subscription?.next_payment_date ?? "",
      }),
    ];
    for (const event of events) {
      const raw = JSON.stringify(event);
      const tasks: (() => Promise<unknown>)[] = [];
      const res = await handlePaystackWebhook(ctx, {
        request: request(raw, signPaystackPayload(raw, SECRET)),
        secretKey: SECRET,
        encryptionKey: KEY,
        enforceIpAllowlist: false,
        schedule: (t) => tasks.push(t),
      });
      expect(res.status).toBe(200);
      expect(tasks).toHaveLength(1);
      await tasks[0]?.();
      // Redelivery: 200, nothing scheduled.
      const again: (() => Promise<unknown>)[] = [];
      const dup = await handlePaystackWebhook(ctx, {
        request: request(raw, signPaystackPayload(raw, SECRET)),
        secretKey: SECRET,
        encryptionKey: KEY,
        enforceIpAllowlist: false,
        schedule: (t) => again.push(t),
      });
      expect(dup.status).toBe(200);
      expect(again).toHaveLength(0);
    }

    const status = await (await call(owner, "status", {}, initech)).json();
    expect(status.subscription.status).toBe("active");
    expect(status.entitlement).toMatchObject({ active: true, plan: "pro" });
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("v1:");
    expect(serialized).not.toContain("AUTH_");
    expect(serialized).not.toContain(subscription?.email_token ?? "never");
  });
});

describe("cron auth", () => {
  it("needs the exact bearer secret", () => {
    const req = (h?: string) =>
      new Request("http://x", { headers: h ? { authorization: h } : {} });
    expect(isAuthorizedCron(req(), "s3cret-s3cret-s3cret")).toBe(false);
    expect(isAuthorizedCron(req("Bearer nope"), "s3cret-s3cret-s3cret")).toBe(
      false
    );
    expect(
      isAuthorizedCron(
        req("Bearer s3cret-s3cret-s3cret"),
        "s3cret-s3cret-s3cret"
      )
    ).toBe(true);
  });
});

describe("per-user rate limit on billing mutations (audit #7)", () => {
  it("answers 429 after 20 mutations a minute, and still serves status", async () => {
    const busy = await signUp("busy@initech.test");
    const org = await ctx.authService.auth.api.createOrganization({
      headers: busy,
      body: { name: "Busy Co", slug: "busy-co" },
    });
    const busyOrg = org?.id ?? "";
    for (let i = 0; i < 20; i++) {
      expect((await call(busy, "cancel", {}, busyOrg)).status).toBe(409);
    }
    const limited = await call(busy, "cancel", {}, busyOrg);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await call(busy, "status", {}, busyOrg)).status).toBe(200);
    // Someone else is unaffected.
    expect((await call(owner, "cancel")).status).not.toBe(429);
  });
});

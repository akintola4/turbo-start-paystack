import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  planCodeOf,
  subscriptionSchema,
  transactionSchema,
} from "../src/paystack/types";
import { type BillingHarness, planCode, setupBilling } from "./support";

/*
 * Payloads shaped after Paystack's documented samples
 * (paystack.com/docs/payments/webhooks, /docs/payments/subscriptions and
 * /docs/api/subscription), not after the fake. The mock always sent tidy
 * objects; real Paystack sends `plan` as `{}`, `0` or a numeric id,
 * `metadata` as `0` or a string, `authorization` as `{}` on an unpaid
 * transaction, and numeric ids from `POST /subscription`. Identities are
 * demo values; codes and references come from the flow under test.
 */

let h: BillingHarness;
const START = new Date("2026-03-01T10:00:00Z");
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());
afterEach(() => {
  h.clock.now = START;
});

type Customer = { customer_code: string; email: string };

const docAuthorization = {
  authorization_code: "AUTH_f5rnfq9p",
  bin: "408408",
  last4: "4081",
  exp_month: "12",
  exp_year: "2030",
  channel: "card",
  card_type: "visa ",
  bank: "TEST BANK",
  country_code: "NG",
  brand: "visa",
  reusable: true,
  signature: "SIG_test0001",
  account_name: null,
};

/** `charge.success` as in the webhooks guide: `metadata: 0`, a `log`,
 *  `fees: null`, a customer with an id, and `plan` as given. */
function docChargeSuccess(input: {
  reference: string;
  amount: number;
  customer: Customer;
  plan: unknown;
  metadata?: unknown;
  paidAt?: string;
}) {
  const paidAt = input.paidAt ?? START.toISOString();
  return {
    event: "charge.success",
    data: {
      id: 302_961,
      domain: "test",
      status: "success",
      reference: input.reference,
      amount: input.amount,
      message: null,
      gateway_response: "Approved by Financial Institution",
      paid_at: paidAt,
      created_at: paidAt,
      channel: "card",
      currency: "NGN",
      ip_address: "41.242.49.37",
      metadata: input.metadata ?? 0,
      log: {
        time_spent: 16,
        attempts: 1,
        authentication: "pin",
        errors: 0,
        success: false,
        mobile: false,
        input: [],
        channel: null,
        history: [],
      },
      fees: null,
      customer: {
        id: 68_324,
        first_name: "Ada",
        last_name: "Demo",
        email: input.customer.email,
        customer_code: input.customer.customer_code,
        phone: null,
        metadata: null,
        risk_action: "default",
      },
      authorization: docAuthorization,
      plan: input.plan,
    },
  };
}

function docPlan(code: string) {
  return {
    id: 28,
    name: "Starter",
    plan_code: code,
    description: null,
    amount: 1_000_000,
    interval: "monthly",
    send_invoices: true,
    send_sms: true,
    currency: "NGN",
  };
}

function docSubscriptionRef(code: string) {
  return {
    status: "active",
    subscription_code: code,
    email_token: "d7gofp6yppn3qz7",
    amount: 1_000_000,
    cron_expression: "0 0 28 * *",
    next_payment_date: "2026-04-01T10:00:00.000Z",
    open_invoice: null,
  };
}

async function trialCheckout() {
  const org = await h.createOrg();
  const checkout = await h.billing.startCheckout({
    ...org,
    planPriceId: "starter-monthly-ngn",
  });
  const paid = h.pay(checkout.reference);
  return { org, checkout, customer: paid.customer };
}

describe("payload schemas", () => {
  it.each([
    ["0", 0],
    ["a numeric plan id", 28],
    ["{}", {}],
    ["null", null],
    ["missing", undefined],
  ])("reads `plan` as %s as no plan code", (_label, plan) => {
    const tx = transactionSchema.parse({
      status: "success",
      reference: "tsp_ref",
      amount: 5000,
      currency: "NGN",
      plan,
    });
    expect(planCodeOf(tx.plan)).toBeUndefined();
  });

  it('reads `metadata` as an object, a JSON string, `""` or `0`', () => {
    const parse = (metadata: unknown) =>
      transactionSchema.parse({
        status: "success",
        reference: "tsp_ref",
        amount: 5000,
        currency: "NGN",
        metadata,
      }).metadata;
    expect(parse({ organization_id: "org_1" })).toEqual({
      organization_id: "org_1",
    });
    expect(parse('{"organization_id":"org_1"}')).toEqual({
      organization_id: "org_1",
    });
    expect(parse("")).toEqual({});
    expect(parse(0)).toEqual({});
    expect(parse("0")).toEqual({});
  });

  it("parses a verify response: `paidAt` only, `plan: null`, `authorization: {}`", () => {
    const tx = transactionSchema.parse({
      id: 4_099_260_516,
      domain: "test",
      status: "abandoned",
      reference: "tsp_ref",
      receipt_number: null,
      amount: 5000,
      message: null,
      gateway_response: "The transaction was not completed",
      paidAt: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      channel: "card",
      currency: "NGN",
      metadata: "",
      fees: null,
      authorization: {},
      customer: {
        id: 68_324,
        email: "ada@demo.test",
        customer_code: "CUS_demo",
      },
      plan: null,
      split: {},
      order_id: null,
      plan_object: {},
      subaccount: {},
    });
    expect(tx.authorization).toBeNull();
    expect(tx.paid_at).toBeNull();

    const paid = transactionSchema.parse({
      status: "success",
      reference: "tsp_ref",
      amount: 5000,
      currency: "NGN",
      paidAt: "2026-03-01T10:00:05.000Z",
    });
    expect(paid.paid_at).toBe("2026-03-01T10:00:05.000Z");
  });

  it("parses POST /subscription's response, where plan and customer are ids", () => {
    const sub = subscriptionSchema.parse({
      customer: 1173,
      plan: 28,
      integration: 100_032,
      domain: "test",
      start: 1_459_296_064,
      status: "active",
      quantity: 1,
      amount: 50_000,
      authorization: 0,
      subscription_code: "SUB_vsyqdmlzble3uii",
      email_token: "d7gofp6yppn3qz7",
      id: 9,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });
    expect(sub.subscription_code).toBe("SUB_vsyqdmlzble3uii");
    expect(planCodeOf(sub.plan)).toBeUndefined();
  });

  it("stays strict on the fields that decide billing state", () => {
    const base = {
      status: "success",
      reference: "tsp_ref",
      amount: 5000,
      currency: "NGN",
    };
    expect(() =>
      transactionSchema.parse({ ...base, amount: "5000" })
    ).toThrow();
    expect(() => transactionSchema.parse({ ...base, amount: 50.5 })).toThrow();
    expect(() =>
      transactionSchema.parse({ ...base, reference: undefined })
    ).toThrow();
    expect(() =>
      transactionSchema.parse({ ...base, currency: undefined })
    ).toThrow();
    expect(() =>
      transactionSchema.parse({ ...base, customer: { email: "a@b.test" } })
    ).toThrow();
  });
});

describe("documented webhook payloads parse and process", () => {
  it.each([
    ["plan: 0", 0],
    ["plan: a numeric id", 28],
    ["plan: {}", {}],
  ])(
    "charge.success for the trial card check (%s) starts the trial",
    async (_label, plan) => {
      const { org, checkout, customer } = await trialCheckout();
      const event = await h.deliver(
        docChargeSuccess({
          reference: checkout.reference,
          amount: 5000,
          customer,
          plan,
          metadata: JSON.stringify({ organization_id: org.organizationId }),
        })
      );
      expect(event?.error).toBeNull();
      expect(event?.processedAt).not.toBeNull();
      const sub = await h.billing.getSubscription(org.organizationId);
      expect(sub?.status).toBe("trialing");
      expect(sub?.paystackSubscriptionCode).toMatch(/^SUB_/);
      expect(h.fake.refunds.at(-1)?.transaction).toBe(checkout.reference);
    }
  );

  it("charge.success for a renewal (plan object, metadata 0) moves the period", async () => {
    const { organizationId, sub, paid } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.clock.now = new Date(sub.currentPeriodEnd ?? 0);
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    if (remote) {
      remote.next_payment_date = "2026-05-01T10:00:00.000Z";
    }
    const event = await h.deliver(
      docChargeSuccess({
        reference: "renewal_doc_1",
        amount: 1_000_000,
        customer: paid.customer,
        plan: docPlan(planCode("starter-monthly-ngn")),
        paidAt: h.clock.now.toISOString(),
      })
    );
    expect(event?.error).toBeNull();
    const after = await h.billing.getSubscription(organizationId);
    expect(after?.currentPeriodEnd?.toISOString()).toBe(
      "2026-05-01T10:00:00.000Z"
    );
    const [invoice] = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.reference, "renewal_doc_1"));
    expect(invoice).toMatchObject({ status: "paid", kind: "renewal" });
  });

  it("subscription.create without an email token attaches to the checkout", async () => {
    const org = await h.createOrg({ previouslySubscribed: true });
    const checkout = await h.billing.startCheckout({
      ...org,
      planPriceId: "starter-monthly-ngn",
    });
    const paid = h.pay(checkout.reference);
    await h.deliver(paid.charge);
    const code = paid.subscription?.subscription_code ?? "";
    const event = await h.deliver({
      event: "subscription.create",
      data: {
        domain: "test",
        status: "active",
        subscription_code: code,
        amount: 1_000_000,
        cron_expression: "0 0 28 * *",
        next_payment_date: "2026-04-01T10:00:00.000Z",
        open_invoice: null,
        createdAt: START.toISOString(),
        plan: docPlan(planCode("starter-monthly-ngn")),
        authorization: docAuthorization,
        customer: {
          first_name: "Ada",
          last_name: "Demo",
          email: paid.customer.email,
          customer_code: paid.customer.customer_code,
          phone: "",
          metadata: {},
          risk_action: "default",
        },
        created_at: START.toISOString(),
      },
    });
    expect(event?.error).toBeNull();
    const sub = await h.billing.getSubscription(org.organizationId);
    expect(sub).toMatchObject({
      status: "active",
      paystackSubscriptionCode: code,
    });
  });

  it("invoice.create, invoice.update and invoice.payment_failed as documented", async () => {
    const { organizationId, sub, paid } = await h.subscribe(
      "starter-monthly-ngn"
    );
    const code = sub.paystackSubscriptionCode ?? "";
    const periodStart = sub.currentPeriodEnd?.toISOString() ?? "";
    const invoice = (event: string, extra: Record<string, unknown>) => ({
      event,
      data: {
        domain: "test",
        invoice_code: "INV_thy2vkmirn2urwv",
        amount: 1_000_000,
        period_start: periodStart,
        period_end: "2026-05-01T10:00:00.000Z",
        description: null,
        authorization: docAuthorization,
        subscription: docSubscriptionRef(code),
        customer: {
          id: 46,
          first_name: "Ada",
          last_name: "Demo",
          email: paid.customer.email,
          customer_code: paid.customer.customer_code,
          phone: null,
          metadata: null,
          risk_action: "default",
        },
        created_at: START.toISOString(),
        ...extra,
      },
    });

    const created = await h.deliver(
      invoice("invoice.create", {
        status: "pending",
        paid: false,
        paid_at: null,
        transaction: {},
      })
    );
    expect(created?.error).toBeNull();

    h.clock.now = new Date(sub.currentPeriodEnd ?? 0);
    const failed = await h.deliver(
      invoice("invoice.payment_failed", {
        status: "failed",
        paid: 0,
        paid_at: null,
        transaction: {},
      })
    );
    expect(failed?.error).toBeNull();
    expect((await h.billing.getSubscription(organizationId))?.status).toBe(
      "past_due"
    );

    const updated = await h.deliver(
      invoice("invoice.update", {
        status: "success",
        paid: true,
        paid_at: h.clock.now.toISOString(),
        transaction: {
          reference: "9cfbae6e-bbf3-5b41-8aef-d72c1a17650g",
          status: "success",
          amount: 1_000_000,
          currency: "NGN",
        },
      })
    );
    expect(updated?.error).toBeNull();
    const [row] = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.paystackInvoiceCode, "INV_thy2vkmirn2urwv"));
    expect(row?.status).toBe("paid");
  });

  it("subscription.disable (status complete, plan with id) ends the plan", async () => {
    const { organizationId, sub, paid } = await h.subscribe(
      "starter-monthly-ngn"
    );
    h.clock.now = new Date((sub.currentPeriodEnd?.getTime() ?? 0) + 1000);
    const event = await h.deliver({
      event: "subscription.disable",
      data: {
        domain: "test",
        status: "complete",
        subscription_code: sub.paystackSubscriptionCode,
        email_token: "ctt824k16n34u69",
        amount: 1_000_000,
        cron_expression: "0 0 * * 0",
        next_payment_date: null,
        open_invoice: null,
        plan: docPlan(planCode("starter-monthly-ngn")),
        authorization: docAuthorization,
        customer: {
          id: 63,
          first_name: "Ada",
          last_name: "Demo",
          email: paid.customer.email,
          customer_code: paid.customer.customer_code,
          phone: "",
          metadata: {},
          risk_action: "default",
        },
        created_at: START.toISOString(),
      },
    });
    expect(event?.error).toBeNull();
    const [row] = await h.db
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.organizationId, organizationId));
    expect(row?.status).toBe("canceled");
  });
});

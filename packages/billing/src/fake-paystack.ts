import { randomBytes } from "node:crypto";

import { type Authorization, testAuthorization } from "./fixtures";

/**
 * In-memory stand-in for the Paystack API: enough of /customer, /transaction,
 * /subscription, /plan and /refund for tests (through msw) and for local
 * development without keys (scripts/paystack-mock.ts). It is not a Paystack
 * simulator: behaviour that needs confirming against real test mode is listed
 * in docs/paystack-verification.md.
 */

type Tx = {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  plan?: string;
  metadata: Record<string, unknown>;
  status: "pending" | "success" | "failed" | "abandoned";
  paid_at: string | null;
  authorization: Authorization | null;
  customer_code: string;
  callback_url?: string;
  access_code: string;
};

type Sub = {
  subscription_code: string;
  email_token: string;
  status: "active" | "non-renewing" | "attention" | "completed" | "cancelled";
  plan: string;
  customer: string;
  authorization: string;
  next_payment_date: string;
};

type Call = { method: string; path: string; body: Record<string, unknown> };

type Failure = {
  method: string;
  path: RegExp;
  status: number;
  message: string;
};

const id = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}`;

export function createFakePaystack(options?: {
  checkoutBaseUrl?: string;
  now?: () => Date;
}) {
  const now = options?.now ?? (() => new Date());
  const checkoutBaseUrl =
    options?.checkoutBaseUrl ?? "https://checkout.paystack.test";
  const customers = new Map<string, { customer_code: string; email: string }>();
  const transactions = new Map<string, Tx>();
  const subscriptions = new Map<string, Sub>();
  const plans = new Map<
    string,
    {
      plan_code: string;
      name: string;
      amount: number;
      interval: string;
      currency: string;
    }
  >();
  const refunds: { transaction: string; amount?: number }[] = [];
  const calls: Call[] = [];
  const failures: Failure[] = [];
  let chargeOutcome: "success" | "failed" | "paused" = "success";

  const ok = (data: unknown, message = "ok") =>
    Response.json({ status: true, message, data });
  const fail = (status: number, message: string) =>
    Response.json({ status: false, message }, { status });

  function customerFor(email: string) {
    let customer = customers.get(email);
    if (!customer) {
      customer = { customer_code: id("CUS"), email };
      customers.set(email, customer);
    }
    return customer;
  }

  function txView(tx: Tx) {
    return {
      id: 1,
      status: tx.status,
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency,
      paid_at: tx.paid_at,
      metadata: tx.metadata,
      authorization: tx.authorization,
      customer: { customer_code: tx.customer_code, email: tx.email },
      plan: tx.plan ? { plan_code: tx.plan } : null,
    };
  }

  function subView(sub: Sub) {
    return {
      ...sub,
      plan: { plan_code: sub.plan },
      customer: {
        customer_code: sub.customer,
        email: [...customers.values()].find(
          (c) => c.customer_code === sub.customer
        )?.email,
      },
    };
  }

  /** Simulates the customer completing checkout. Returns the transaction as
   *  Paystack would send it in `charge.success`, and for plan checkouts also
   *  creates the subscription (as Paystack does). */
  function pay(reference: string, authorization = testAuthorization()) {
    const tx = transactions.get(reference);
    if (!tx) {
      throw new Error(`fake paystack: unknown reference ${reference}`);
    }
    tx.status = "success";
    tx.paid_at = now().toISOString();
    tx.authorization = authorization;
    let subscription: Sub | undefined;
    if (tx.plan) {
      const next = new Date(now());
      next.setUTCMonth(next.getUTCMonth() + 1);
      subscription = {
        subscription_code: id("SUB"),
        email_token: id("tok"),
        status: "active",
        plan: tx.plan,
        customer: tx.customer_code,
        authorization: authorization.authorization_code,
        next_payment_date: next.toISOString(),
      };
      subscriptions.set(subscription.subscription_code, subscription);
    }
    return { transaction: txView(tx), subscription };
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const body =
      method === "GET"
        ? {}
        : ((await request.json().catch(() => ({}))) as Record<string, unknown>);
    calls.push({ method, path, body });

    const failureIndex = failures.findIndex(
      (f) => f.method === method && f.path.test(path)
    );
    if (failureIndex >= 0) {
      const [failure] = failures.splice(failureIndex, 1);
      if (failure) {
        return fail(failure.status, failure.message);
      }
    }

    if (method === "POST" && path === "/customer") {
      return ok(customerFor(String(body.email)));
    }

    if (method === "POST" && path === "/transaction/initialize") {
      const reference = String(body.reference ?? id("ref"));
      if (transactions.has(reference)) {
        return fail(400, "Duplicate Transaction Reference");
      }
      const planCode = body.plan ? String(body.plan) : undefined;
      const plan = planCode ? plans.get(planCode) : undefined;
      const access_code = id("acc");
      const tx: Tx = {
        reference,
        // A plan's amount overrides the amount sent (documented behaviour).
        amount: plan ? plan.amount : Number(body.amount),
        currency: String(body.currency ?? "NGN"),
        email: String(body.email),
        plan: planCode,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        status: "pending",
        paid_at: null,
        authorization: null,
        customer_code: customerFor(String(body.email)).customer_code,
        callback_url: body.callback_url as string | undefined,
        access_code,
      };
      transactions.set(reference, tx);
      return ok({
        authorization_url: `${checkoutBaseUrl}/${access_code}`,
        access_code,
        reference,
      });
    }

    const verify = path.match(/^\/transaction\/verify\/(.+)$/);
    if (method === "GET" && verify?.[1]) {
      const tx = transactions.get(decodeURIComponent(verify[1]));
      if (!tx) {
        return fail(400, "Transaction reference not found");
      }
      const view = txView(tx);
      return ok({
        ...view,
        status: tx.status === "pending" ? "abandoned" : tx.status,
      });
    }

    if (method === "POST" && path === "/transaction/charge_authorization") {
      const reference = String(body.reference);
      const email = String(body.email);
      const customer = customerFor(email);
      const status =
        chargeOutcome === "paused"
          ? "success"
          : chargeOutcome === "success"
            ? "success"
            : "failed";
      const tx: Tx = {
        reference,
        amount: Number(body.amount),
        currency: String(body.currency ?? "NGN"),
        email,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        status: chargeOutcome === "paused" ? "pending" : status,
        paid_at: chargeOutcome === "success" ? now().toISOString() : null,
        authorization: testAuthorization({
          authorization_code: String(body.authorization_code),
        }),
        customer_code: customer.customer_code,
        access_code: id("acc"),
      };
      transactions.set(reference, tx);
      return ok({
        ...txView(tx),
        status: chargeOutcome === "paused" ? "success" : tx.status,
        paused: chargeOutcome === "paused",
        authorization_url:
          chargeOutcome === "paused"
            ? `${checkoutBaseUrl}/${tx.access_code}`
            : null,
      });
    }

    if (method === "POST" && path === "/refund") {
      refunds.push({
        transaction: String(body.transaction),
        amount: body.amount as number | undefined,
      });
      return ok({ status: "pending" });
    }

    if (method === "POST" && path === "/subscription") {
      const plan = String(body.plan);
      if (!plans.has(plan)) {
        return fail(400, "Plan not found");
      }
      const sub: Sub = {
        subscription_code: id("SUB"),
        email_token: id("tok"),
        status: "active",
        plan,
        customer: String(body.customer),
        authorization: String(body.authorization ?? ""),
        next_payment_date: String(body.start_date ?? now().toISOString()),
      };
      subscriptions.set(sub.subscription_code, sub);
      return ok(subView(sub));
    }

    const manage = path.match(/^\/subscription\/([^/]+)\/manage\/link$/);
    if (method === "GET" && manage?.[1]) {
      return ok({ link: `${checkoutBaseUrl}/manage/${manage[1]}` });
    }

    const fetchSub = path.match(/^\/subscription\/([^/]+)$/);
    if (method === "GET" && fetchSub?.[1]) {
      const sub = subscriptions.get(decodeURIComponent(fetchSub[1]));
      return sub ? ok(subView(sub)) : fail(404, "Subscription not found");
    }

    if (
      method === "POST" &&
      (path === "/subscription/disable" || path === "/subscription/enable")
    ) {
      const sub = subscriptions.get(String(body.code));
      if (!sub || sub.email_token !== body.token) {
        return fail(
          400,
          "Subscription with code not found or already inactive"
        );
      }
      sub.status = path.endsWith("disable") ? "non-renewing" : "active";
      return ok(
        null,
        `Subscription ${path.endsWith("disable") ? "disabled" : "enabled"} successfully`
      );
    }

    if (method === "POST" && path === "/plan") {
      const plan = {
        plan_code: id("PLN"),
        name: String(body.name),
        amount: Number(body.amount),
        interval: String(body.interval),
        currency: String(body.currency ?? "NGN"),
      };
      plans.set(plan.plan_code, plan);
      return ok(plan);
    }

    if (method === "GET" && path === "/plan") {
      return ok([...plans.values()]);
    }

    return fail(404, `fake paystack: no route for ${method} ${path}`);
  }

  return {
    handle,
    pay,
    calls,
    refunds,
    customers,
    transactions,
    subscriptions,
    plans,
    /** Makes the next matching request fail once. */
    failNext(method: string, path: RegExp, status = 500, message = "boom") {
      failures.push({ method, path, status, message });
    },
    setChargeOutcome(outcome: "success" | "failed" | "paused") {
      chargeOutcome = outcome;
    },
    /** Registers a plan without an HTTP call (seeding). */
    addPlan(plan: {
      plan_code: string;
      name: string;
      amount: number;
      interval: string;
      currency: string;
    }) {
      plans.set(plan.plan_code, plan);
    },
    callsTo(method: string, path: string | RegExp) {
      return calls.filter(
        (c) =>
          c.method === method &&
          (typeof path === "string" ? c.path === path : path.test(c.path))
      );
    },
  };
}

export type FakePaystack = ReturnType<typeof createFakePaystack>;

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
  /** Invoice of a failed renewal, until a later charge pays it. */
  open_invoice?: string;
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
  const customers = new Map<
    string,
    { customer_code: string; email: string; id?: number }
  >();
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
      id?: number;
    }
  >();
  // Paystack's numeric ids, which some endpoints answer with instead of
  // codes. Assigned lazily so snapshots from before they existed restore.
  let nextNumericId = 1000;
  const numericId = (record: { id?: number }) => {
    record.id ??= nextNumericId++;
    return record.id;
  };
  const customerByCode = (code: string) =>
    [...customers.values()].find((c) => c.customer_code === code);
  const refunds: { transaction: string; amount?: number }[] = [];
  const calls: Call[] = [];
  const failures: Failure[] = [];
  let chargeOutcome: "success" | "failed" | "paused" = "success";

  const ok = (data: unknown, message = "ok") =>
    Response.json({ status: true, message, data });
  const fail = (status: number, message: string) =>
    Response.json({ status: false, message }, { status });

  /** One customer per email, as on Paystack: asking again for an address
   *  it knows (in any case) returns the existing customer. */
  function customerFor(rawEmail: string) {
    const email = rawEmail.toLowerCase();
    let customer = customers.get(email);
    if (!customer) {
      customer = { customer_code: id("CUS"), email, id: nextNumericId++ };
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
      // Shaped like the verify endpoint: `{}` for an unpaid authorization,
      // and the paid date as both `paid_at` and `paidAt`.
      return ok({
        ...view,
        status: tx.status === "pending" ? "abandoned" : tx.status,
        authorization: view.authorization ?? {},
        paidAt: view.paid_at,
        plan_object: view.plan ?? {},
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

    const fetchCustomer = path.match(/^\/customer\/([^/]+)$/);
    if (method === "GET" && fetchCustomer?.[1]) {
      // `GET /customer/:email_or_code`
      const key = decodeURIComponent(fetchCustomer[1]);
      const customer = customerByCode(key) ?? customers.get(key.toLowerCase());
      return customer
        ? ok({ ...customer, id: numericId(customer) })
        : fail(404, "Customer not found");
    }

    if (method === "GET" && path === "/subscription") {
      const customerId = Number(url.searchParams.get("customer"));
      const customer = [...customers.values()].find(
        (c) => numericId(c) === customerId
      );
      return ok(
        [...subscriptions.values()]
          .filter((sub) => sub.customer === customer?.customer_code)
          .reverse()
          .map(subView)
      );
    }

    if (method === "POST" && path === "/subscription") {
      const plan = String(body.plan);
      const planRecord = plans.get(plan);
      if (!planRecord) {
        return fail(400, "Plan not found");
      }
      const customerCode = String(body.customer);
      // Paystack allows one live subscription per customer and plan.
      if (
        [...subscriptions.values()].some(
          (s) =>
            s.customer === customerCode &&
            s.plan === plan &&
            s.status === "active"
        )
      ) {
        return fail(400, "This subscription is already in place.");
      }
      const sub: Sub = {
        subscription_code: id("SUB"),
        email_token: id("tok"),
        status: "active",
        plan,
        customer: customerCode,
        authorization: String(body.authorization ?? ""),
        next_payment_date: String(body.start_date ?? now().toISOString()),
      };
      subscriptions.set(sub.subscription_code, sub);
      // As documented: plan, customer and authorization come back as
      // numeric ids, not objects or codes.
      const customer = customerByCode(customerCode);
      return ok({
        customer: customer ? numericId(customer) : 0,
        plan: numericId(planRecord),
        integration: 100032,
        domain: "test",
        start: Math.floor(now().getTime() / 1000),
        status: sub.status,
        quantity: 1,
        amount: planRecord.amount,
        authorization: 0,
        subscription_code: sub.subscription_code,
        email_token: sub.email_token,
        id: 9,
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
      });
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
      const disabling = path.endsWith("disable");
      if (
        !sub ||
        sub.email_token !== body.token ||
        (disabling && sub.status !== "active")
      ) {
        return fail(
          400,
          "Subscription with code not found or already inactive"
        );
      }
      // As on Paystack: a disabled subscription is final.
      if (!disabling && sub.status !== "active") {
        return fail(
          400,
          "Subscription has been cancelled, and cannot be reactivated"
        );
      }
      sub.status = disabling ? "non-renewing" : "active";
      return ok(
        null,
        `Subscription ${disabling ? "disabled" : "enabled"} successfully`
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

  /** Plain-JSON copy of the state, so the dev mock survives restarts. */
  function snapshot() {
    return {
      customers: [...customers.values()],
      transactions: [...transactions.values()],
      subscriptions: [...subscriptions.values()],
      plans: [...plans.values()],
    };
  }

  function restore(state: ReturnType<typeof snapshot>) {
    for (const c of state.customers) customers.set(c.email.toLowerCase(), c);
    for (const t of state.transactions) transactions.set(t.reference, t);
    for (const s of state.subscriptions)
      subscriptions.set(s.subscription_code, s);
    for (const p of state.plans) plans.set(p.plan_code, p);
  }

  return {
    handle,
    pay,
    snapshot,
    restore,
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

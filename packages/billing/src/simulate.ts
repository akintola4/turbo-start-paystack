import { createHash, randomBytes } from "node:crypto";

import { addInterval } from "./catalog";
import type { FakePaystack } from "./fake-paystack";
import { chargeSuccess, invoiceEvent, testAuthorization } from "./fixtures";
import { signPaystackPayload } from "./webhook/verify";

/**
 * Plays a subscription's billing lifecycle against the fake Paystack, the way
 * Paystack would: it moves the fake's own subscription state, then delivers
 * signed webhooks to the app. Development only (the local mock's "Simulate
 * billing" panel) and tests. It never touches the app's database: whatever
 * happens there is the webhook handlers' doing.
 */

export const SIMULATE_ACTIONS = [
  "renew",
  "fail",
  "recover",
  "duplicate",
  "forged",
] as const;
export type SimulateAction = (typeof SIMULATE_ACTIONS)[number];

export type Delivery = {
  event: string;
  /** HTTP status the webhook route answered with. */
  status: number;
  /** The route's JSON answer, e.g. `{ ok: true, duplicate: true }`. */
  response: unknown;
  /** sha256 of the body: the `webhook_event.dedupe_key` the app stores. */
  dedupeKey: string;
  signed: boolean;
};

/** Sends one raw body with its signature header (or none). */
export type Deliver = (
  body: string,
  signature: string | null
) => Promise<{ status: number; response: unknown }>;

export class SimulateError extends Error {
  constructor(
    readonly code: "unknown_subscription" | "nothing_to_duplicate",
    message: string
  ) {
    super(message);
  }
}

const id = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}`;
const FORGERY_KEY = "sk_test_not_the_real_key";
/** Gap between events of one step, so they arrive in order like Paystack's. */
const EVENT_GAP_MS = 150;

export function createWebhookSimulator(options: {
  fake: FakePaystack;
  secretKey: string;
  deliver: Deliver;
  gapMs?: number;
}) {
  const { fake, secretKey, deliver } = options;
  const gapMs = options.gapMs ?? EVENT_GAP_MS;
  /** Last signed body per subscription, for "duplicate". */
  const lastBody = new Map<string, string>();

  async function send(
    subscriptionCode: string,
    payload: { event: string },
    signWith: string | null = secretKey
  ): Promise<Delivery> {
    const body = JSON.stringify(payload);
    const signature = signWith ? signPaystackPayload(body, signWith) : null;
    const result = await deliver(body, signature);
    if (signWith === secretKey) {
      lastBody.set(subscriptionCode, body);
    }
    return {
      event: payload.event,
      status: result.status,
      response: result.response,
      dedupeKey: createHash("sha256").update(body).digest("hex"),
      signed: signWith === secretKey,
    };
  }

  async function sendAll(code: string, payloads: { event: string }[]) {
    const out: Delivery[] = [];
    for (const [i, payload] of payloads.entries()) {
      if (i > 0 && gapMs > 0) {
        await new Promise((r) => setTimeout(r, gapMs));
      }
      out.push(await send(code, payload));
    }
    return out;
  }

  function context(subscriptionCode: string) {
    const sub = fake.subscriptions.get(subscriptionCode);
    if (!sub) {
      throw new SimulateError(
        "unknown_subscription",
        "The mock has no such subscription. Subscribe through the mock checkout first."
      );
    }
    const plan = fake.plans.get(sub.plan);
    const email =
      [...fake.customers.values()].find((c) => c.customer_code === sub.customer)
        ?.email ?? "";
    const due = new Date(sub.next_payment_date);
    const interval = plan?.interval === "annually" ? "annually" : "monthly";
    return {
      sub,
      amount: plan?.amount ?? 0,
      currency: plan?.currency ?? "NGN",
      customer: { customer_code: sub.customer, email },
      due,
      periodEnd: addInterval(due, interval),
    };
  }

  /** A successful charge on the renewal date, then its invoice. The fake's
   *  next payment date moves one interval, as Paystack's does. */
  function renewal(code: string) {
    const c = context(code);
    const reference = id("T");
    const invoiceCode = c.sub.open_invoice ?? id("INV");
    const recovering = Boolean(c.sub.open_invoice);
    const authorization = testAuthorization({
      authorization_code: c.sub.authorization || "AUTH_test0001",
    });
    fake.transactions.set(reference, {
      reference,
      amount: c.amount,
      currency: c.currency,
      email: c.customer.email,
      plan: c.sub.plan,
      metadata: {},
      status: "success",
      paid_at: c.due.toISOString(),
      authorization,
      customer_code: c.sub.customer,
      access_code: id("acc"),
    });
    c.sub.status = "active";
    c.sub.next_payment_date = c.periodEnd.toISOString();
    c.sub.open_invoice = undefined;

    const charge = chargeSuccess({
      reference,
      amount: c.amount,
      currency: c.currency,
      customer: c.customer,
      authorization,
      planCode: c.sub.plan,
      paidAt: c.due.toISOString(),
    });
    const invoice = invoiceEvent({
      event: "invoice.update",
      invoiceCode,
      subscriptionCode: code,
      amount: c.amount,
      currency: c.currency,
      status: "success",
      paid: true,
      customer: c.customer,
      periodStart: c.due.toISOString(),
      periodEnd: c.periodEnd.toISOString(),
      reference,
      paidAt: c.due.toISOString(),
    });
    // A recovered payment settles the failed invoice; send that first so
    // the charge lands on the same invoice row instead of a new one.
    return recovering ? [invoice, charge] : [charge, invoice];
  }

  /** The renewal charge is declined: Paystack marks the subscription
   *  "attention" and sends invoice.payment_failed. */
  function failure(code: string) {
    const c = context(code);
    const invoiceCode = c.sub.open_invoice ?? id("INV");
    c.sub.status = "attention";
    c.sub.open_invoice = invoiceCode;
    return [
      invoiceEvent({
        event: "invoice.payment_failed",
        invoiceCode,
        subscriptionCode: code,
        amount: c.amount,
        currency: c.currency,
        status: "failed",
        paid: false,
        customer: c.customer,
        periodStart: c.due.toISOString(),
        periodEnd: c.periodEnd.toISOString(),
      }),
    ];
  }

  async function run(
    action: SimulateAction,
    subscriptionCode: string
  ): Promise<Delivery[]> {
    switch (action) {
      case "renew":
      case "recover":
        return sendAll(subscriptionCode, renewal(subscriptionCode));
      case "fail":
        return sendAll(subscriptionCode, failure(subscriptionCode));
      case "duplicate": {
        const body = lastBody.get(subscriptionCode);
        if (!body) {
          throw new SimulateError(
            "nothing_to_duplicate",
            "Send an event for this subscription first."
          );
        }
        return [await send(subscriptionCode, JSON.parse(body))];
      }
      case "forged": {
        // A charge.success nobody paid for, signed with the wrong key. The
        // fake's state is not touched.
        const c = context(subscriptionCode);
        const payload = chargeSuccess({
          reference: id("forged"),
          amount: c.amount,
          currency: c.currency,
          customer: c.customer,
          planCode: c.sub.plan,
        });
        return [await send(subscriptionCode, payload, FORGERY_KEY)];
      }
      default:
        throw new Error(`unknown action ${action satisfies never}`);
    }
  }

  return {
    run,
    /** Records a body sent by someone else (the mock checkout) so
     *  "duplicate" can replay it. */
    remember(subscriptionCode: string, body: string) {
      lastBody.set(subscriptionCode, body);
    },
  };
}

export type WebhookSimulator = ReturnType<typeof createWebhookSimulator>;

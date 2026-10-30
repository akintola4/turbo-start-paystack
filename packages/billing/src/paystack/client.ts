import { z } from "zod";

import { PaystackError } from "../errors";
import {
  customerDetailSchema,
  customerSchema,
  initializeSchema,
  manageLinkSchema,
  planSchema,
  refundSchema,
  subscriptionSchema,
  transactionSchema,
} from "./types";

export type PaystackClientOptions = {
  secretKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  maxRetries?: number;
  /** Injected so tests don't actually wait. */
  sleep?: (ms: number) => Promise<void>;
};

type Method = "GET" | "POST" | "PUT";

/** Endpoints that answer `{ status, message }` with no `data`. */
const noData = z.unknown();

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A thin, typed Paystack API client: the ~15 endpoints this starter uses,
 * Zod-validated (unknown fields pass through), retrying 429 and 5xx with
 * backoff. Paystack has no idempotency-key header; callers pass their own
 * unique `reference` instead.
 */
export function createPaystackClient(options: PaystackClientOptions) {
  const baseUrl = (options.baseUrl ?? "https://api.paystack.co").replace(
    /\/$/,
    ""
  );
  // Resolved per call so instrumented fetch (msw, tracing) is picked up.
  const doFetch: typeof fetch = (input, init) =>
    (options.fetch ?? globalThis.fetch)(input, init);
  const maxRetries = options.maxRetries ?? 3;
  const sleep = options.sleep ?? defaultSleep;

  async function request<S extends z.ZodType>(
    method: Method,
    path: string,
    schema: S,
    body?: Record<string, unknown>
  ): Promise<z.infer<S>> {
    let attempt = 0;
    while (true) {
      const res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${options.secretKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 250 * 2 ** attempt;
        attempt += 1;
        await sleep(wait);
        continue;
      }
      const json = (await res.json().catch(() => null)) as {
        status?: boolean;
        message?: string;
        data?: unknown;
      } | null;
      if (!(res.ok && json?.status)) {
        throw new PaystackError(
          res.status,
          json?.message ??
            `Paystack ${method} ${path} failed with ${res.status}`
        );
      }
      return schema.parse(json.data);
    }
  }

  return {
    createCustomer: (input: {
      email: string;
      metadata?: Record<string, unknown>;
    }) => request("POST", "/customer", customerSchema, input),

    fetchCustomer: (code: string) =>
      request(
        "GET",
        `/customer/${encodeURIComponent(code)}`,
        customerDetailSchema
      ),

    initializeTransaction: (input: {
      email: string;
      amount: number;
      currency: string;
      reference: string;
      callback_url?: string;
      plan?: string;
      channels?: string[];
      metadata?: Record<string, unknown>;
    }) =>
      request("POST", "/transaction/initialize", initializeSchema, {
        ...input,
        // Paystack expects amount as a string or number; send integers only.
        amount: Math.trunc(input.amount),
      }),

    verifyTransaction: (reference: string) =>
      request(
        "GET",
        `/transaction/verify/${encodeURIComponent(reference)}`,
        transactionSchema
      ),

    chargeAuthorization: (input: {
      email: string;
      amount: number;
      authorization_code: string;
      currency: string;
      reference: string;
      metadata?: Record<string, unknown>;
    }) =>
      request(
        "POST",
        "/transaction/charge_authorization",
        transactionSchema,
        input
      ),

    refund: (input: { transaction: string; amount?: number }) =>
      request("POST", "/refund", refundSchema, input),

    createSubscription: (input: {
      customer: string;
      plan: string;
      authorization?: string;
      start_date?: string;
    }) => request("POST", "/subscription", subscriptionSchema, input),

    fetchSubscription: (code: string) =>
      request(
        "GET",
        `/subscription/${encodeURIComponent(code)}`,
        subscriptionSchema
      ),

    /** A customer's subscriptions. Paystack filters by the numeric customer
     *  id, not the customer code. */
    listSubscriptions: (input: { customer: number | string }) =>
      request(
        "GET",
        `/subscription?customer=${encodeURIComponent(String(input.customer))}&perPage=100`,
        subscriptionSchema.array()
      ),

    disableSubscription: (input: { code: string; token: string }) =>
      request("POST", "/subscription/disable", noData, input),

    enableSubscription: (input: { code: string; token: string }) =>
      request("POST", "/subscription/enable", noData, input),

    getManageLink: (code: string) =>
      request(
        "GET",
        `/subscription/${encodeURIComponent(code)}/manage/link`,
        manageLinkSchema
      ),

    createPlan: (input: {
      name: string;
      amount: number;
      interval: string;
      currency: string;
      description?: string;
      send_invoices?: boolean;
      send_sms?: boolean;
    }) => request("POST", "/plan", planSchema, input),

    listPlans: () => request("GET", "/plan?perPage=100", planSchema.array()),
  };
}

export type PaystackClient = ReturnType<typeof createPaystackClient>;

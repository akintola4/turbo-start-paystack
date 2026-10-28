import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PaystackError } from "../src/errors";
import { createPaystackClient } from "../src/paystack/client";

const BASE = "https://api.paystack.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createPaystackClient({
  secretKey: "sk_test_x",
  baseUrl: BASE,
  sleep: async () => undefined,
});

describe("paystack client", () => {
  it("sends the secret key as a bearer token", async () => {
    let auth: string | null = null;
    server.use(
      http.post(`${BASE}/customer`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({
          status: true,
          message: "ok",
          data: { customer_code: "CUS_1", email: "a@b.test", extra: 1 },
        });
      })
    );
    const customer = await client.createCustomer({ email: "a@b.test" });
    expect(auth).toBe("Bearer sk_test_x");
    // Unknown fields pass through.
    expect(customer).toMatchObject({ customer_code: "CUS_1", extra: 1 });
  });

  it("retries a 500 and then succeeds", async () => {
    let n = 0;
    server.use(
      http.get(`${BASE}/transaction/verify/ref_1`, () => {
        n += 1;
        if (n === 1) {
          return HttpResponse.json({ status: false }, { status: 500 });
        }
        return HttpResponse.json({
          status: true,
          message: "ok",
          data: {
            status: "success",
            reference: "ref_1",
            amount: 100,
            currency: "NGN",
            metadata: '{"organization_id":"org_1"}',
          },
        });
      })
    );
    const tx = await client.verifyTransaction("ref_1");
    expect(n).toBe(2);
    // Stringified metadata is parsed.
    expect(tx.metadata).toEqual({ organization_id: "org_1" });
  });

  it("retries 429 at most maxRetries times", async () => {
    let n = 0;
    server.use(
      http.get(`${BASE}/plan`, () => {
        n += 1;
        return HttpResponse.json(
          { status: false, message: "slow down" },
          { status: 429 }
        );
      })
    );
    await expect(client.listPlans()).rejects.toBeInstanceOf(PaystackError);
    expect(n).toBe(4);
  });

  it("throws PaystackError on status:false without retrying a 400", async () => {
    let n = 0;
    server.use(
      http.post(`${BASE}/subscription/disable`, () => {
        n += 1;
        return HttpResponse.json(
          { status: false, message: "Subscription not found" },
          { status: 400 }
        );
      })
    );
    await expect(
      client.disableSubscription({ code: "SUB_x", token: "t" })
    ).rejects.toMatchObject({
      httpStatus: 400,
      message: "Subscription not found",
    });
    expect(n).toBe(1);
  });
});

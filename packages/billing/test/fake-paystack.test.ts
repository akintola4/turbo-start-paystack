import { describe, expect, it } from "vitest";

import { createFakePaystack } from "../src/fake-paystack";

const NOW = new Date("2026-03-01T10:00:00Z");

function setup() {
  const fake = createFakePaystack({ now: () => NOW });
  fake.addPlan({
    plan_code: "PLN_monthly",
    name: "monthly",
    amount: 1_000_000,
    interval: "monthly",
    currency: "NGN",
  });
  fake.addPlan({
    plan_code: "PLN_annual",
    name: "annual",
    amount: 10_000_000,
    interval: "annually",
    currency: "NGN",
  });
  async function post(path: string, body: Record<string, unknown>) {
    const res = await fake.handle(
      new Request(`http://fake${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    return {
      status: res.status,
      json: (await res.json()) as {
        message: string;
        data: { id: number; status: string };
      },
    };
  }
  const charge = (reference: string) =>
    post("/transaction/charge_authorization", {
      email: "owner@acme.test",
      amount: 5000,
      currency: "NGN",
      authorization_code: "AUTH_test0001",
      reference,
    });
  return { fake, post, charge };
}

describe("fake paystack", () => {
  it("sets the first renewal one plan interval after payment", async () => {
    const { fake, post } = setup();
    for (const plan of ["PLN_monthly", "PLN_annual"]) {
      await post("/transaction/initialize", {
        email: "owner@acme.test",
        amount: 1,
        reference: `ref-${plan}`,
        plan,
      });
    }
    expect(fake.pay("ref-PLN_monthly").subscription?.next_payment_date).toBe(
      "2026-04-01T10:00:00.000Z"
    );
    expect(fake.pay("ref-PLN_annual").subscription?.next_payment_date).toBe(
      "2027-03-01T10:00:00.000Z"
    );
  });

  it("rejects a charge_authorization reference it has seen", async () => {
    const { charge } = setup();
    expect((await charge("ref-1")).status).toBe(200);
    const again = await charge("ref-1");
    expect(again.status).toBe(400);
    expect(again.json.message).toBe("Duplicate Transaction Reference");
  });

  it("gives every transaction its own id", async () => {
    const { charge } = setup();
    const a = (await charge("ref-a")).json.data.id;
    const b = (await charge("ref-b")).json.data.id;
    expect(a).not.toBe(b);
  });

  it("can carry out a charge and lose the response", async () => {
    const { fake, charge } = setup();
    fake.loseNextResponse("POST", /charge_authorization/);
    expect((await charge("ref-lost")).status).toBe(504);
    expect(fake.transactions.get("ref-lost")?.status).toBe("success");
  });

  it("settles a refund and returns its webhook", async () => {
    const { fake, charge, post } = setup();
    await charge("ref-r");
    const created = await post("/refund", { transaction: "ref-r" });
    expect(created.json.data.status).toBe("pending");
    const event = fake.settleRefund("ref-r", "failed");
    expect(event).toMatchObject({
      event: "refund.failed",
      data: {
        status: "failed",
        transaction_reference: "ref-r",
        amount: "5000",
        currency: "NGN",
      },
    });
    expect(event.data.refund_reference).toBe(fake.refunds[0]?.refund_reference);
    expect(fake.refunds[0]?.status).toBe("failed");
  });
});

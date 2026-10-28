/**
 * Builders for Paystack webhook payloads, shaped after Paystack's documented
 * examples (https://paystack.com/docs/payments/webhooks/ and
 * https://paystack.com/docs/payments/subscriptions/). Used by the test suite
 * and by `pnpm webhook:replay`. Fields this starter does not read are kept
 * where Paystack documents them, so the handlers see realistic noise.
 */

export type Authorization = {
  authorization_code: string;
  bin?: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  channel: "card";
  card_type: string;
  bank?: string;
  country_code?: string;
  brand: string;
  reusable: boolean;
  signature: string;
  account_name?: string | null;
};

export function testAuthorization(
  overrides: Partial<Authorization> = {}
): Authorization {
  return {
    authorization_code: "AUTH_test0001",
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
    ...overrides,
  };
}

type Customer = { customer_code: string; email: string; id?: number };

export function chargeSuccess(input: {
  reference: string;
  amount: number;
  currency: string;
  customer: Customer;
  authorization?: Authorization;
  metadata?: Record<string, unknown> | string;
  planCode?: string;
  paidAt?: string;
  id?: number;
}) {
  return {
    event: "charge.success",
    data: {
      id: input.id ?? Math.floor(Math.random() * 1e9),
      domain: "test",
      status: "success",
      reference: input.reference,
      amount: input.amount,
      message: null,
      gateway_response: "Successful",
      paid_at: input.paidAt ?? new Date().toISOString(),
      created_at: input.paidAt ?? new Date().toISOString(),
      channel: "card",
      currency: input.currency,
      ip_address: "41.1.25.1",
      metadata: input.metadata ?? "",
      fees: 100,
      customer: {
        id: input.customer.id ?? 84312,
        first_name: null,
        last_name: null,
        email: input.customer.email,
        customer_code: input.customer.customer_code,
        phone: null,
        metadata: null,
        risk_action: "default",
      },
      authorization: input.authorization ?? testAuthorization(),
      plan: input.planCode
        ? { plan_code: input.planCode, name: "plan", interval: "monthly" }
        : {},
    },
  };
}

export function subscriptionCreate(input: {
  subscriptionCode: string;
  emailToken: string;
  planCode: string;
  amount: number;
  customer: Customer;
  nextPaymentDate: string;
  status?: string;
  authorization?: Authorization;
}) {
  return {
    event: "subscription.create",
    data: {
      domain: "test",
      status: input.status ?? "active",
      subscription_code: input.subscriptionCode,
      amount: input.amount,
      cron_expression: "0 0 28 * *",
      next_payment_date: input.nextPaymentDate,
      open_invoice: null,
      createdAt: new Date().toISOString(),
      plan: {
        name: "plan",
        plan_code: input.planCode,
        description: null,
        amount: input.amount,
        interval: "monthly",
        send_invoices: true,
        send_sms: true,
        currency: "NGN",
      },
      authorization: input.authorization ?? testAuthorization(),
      customer: {
        first_name: null,
        last_name: null,
        email: input.customer.email,
        customer_code: input.customer.customer_code,
        phone: "",
        metadata: {},
        risk_action: "default",
      },
      email_token: input.emailToken,
    },
  };
}

function subscriptionRef(code: string, status = "active", next?: string) {
  return {
    status,
    subscription_code: code,
    email_token: "redacted-in-invoice-events",
    amount: 0,
    cron_expression: "0 0 28 * *",
    next_payment_date: next ?? null,
    open_invoice: null,
  };
}

export function invoiceEvent(input: {
  event: "invoice.create" | "invoice.update" | "invoice.payment_failed";
  invoiceCode: string;
  subscriptionCode: string;
  amount: number;
  currency?: string;
  status: "pending" | "success" | "failed";
  paid: boolean;
  customer: Customer;
  periodStart: string;
  periodEnd: string;
  reference?: string;
}) {
  return {
    event: input.event,
    data: {
      domain: "test",
      invoice_code: input.invoiceCode,
      amount: input.amount,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: input.status,
      paid: input.paid,
      paid_at: input.paid ? new Date().toISOString() : null,
      description: null,
      authorization: testAuthorization(),
      subscription: subscriptionRef(input.subscriptionCode),
      customer: {
        first_name: null,
        last_name: null,
        email: input.customer.email,
        customer_code: input.customer.customer_code,
        phone: null,
        metadata: {},
        risk_action: "default",
      },
      transaction: input.reference
        ? {
            reference: input.reference,
            status: input.status,
            amount: input.amount,
            currency: input.currency ?? "NGN",
          }
        : {},
      created_at: new Date().toISOString(),
    },
  };
}

export function subscriptionStatusEvent(input: {
  event: "subscription.not_renew" | "subscription.disable";
  subscriptionCode: string;
  status: "non-renewing" | "complete" | "cancelled";
  planCode: string;
  customer: Customer;
  nextPaymentDate?: string | null;
}) {
  return {
    event: input.event,
    data: {
      domain: "test",
      status: input.status,
      subscription_code: input.subscriptionCode,
      email_token: "redacted-in-status-events",
      amount: 0,
      cron_expression: "0 0 28 * *",
      next_payment_date: input.nextPaymentDate ?? null,
      open_invoice: null,
      plan: { plan_code: input.planCode, name: "plan", interval: "monthly" },
      authorization: testAuthorization(),
      customer: {
        email: input.customer.email,
        customer_code: input.customer.customer_code,
      },
      created_at: new Date().toISOString(),
    },
  };
}

export function expiringCards(input: {
  subscriptionCode: string;
  customer: Customer;
}) {
  return {
    event: "subscription.expiring_cards",
    data: [
      {
        expiry_date: "12/2026",
        description: "visa ending with 4081",
        brand: "visa",
        subscription: {
          id: 1,
          subscription_code: input.subscriptionCode,
          amount: 0,
          next_payment_date: null,
          plan: {
            interval: "monthly",
            id: 1,
            name: "plan",
            plan_code: "PLN_x",
          },
        },
        customer: {
          id: 1,
          first_name: null,
          last_name: null,
          email: input.customer.email,
          customer_code: input.customer.customer_code,
        },
      },
    ],
  };
}

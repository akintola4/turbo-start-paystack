// Regenerates scripts/fixtures/*.json from the typed builders in
// @workspace/billing/fixtures. Run with: pnpm --filter @workspace/scripts exec tsx write-fixtures.ts
import { writeFileSync } from "node:fs";
import {
  chargeSuccess,
  invoiceEvent,
  subscriptionCreate,
  subscriptionStatusEvent,
} from "@workspace/billing/fixtures";

const customer = {
  customer_code: "CUS_replace_me",
  email: "billing@example.com",
};
const fixtures = {
  "charge-success": chargeSuccess({
    reference: "tsp-replace-me",
    amount: 3_000_000,
    currency: "NGN",
    customer,
    planCode: "PLN_replace_me",
    metadata: {
      organization_id: "replace_me",
      payment_intent_id: "tsp-replace-me",
    },
    paidAt: "2026-01-01T10:00:00.000Z",
    id: 1,
  }),
  "subscription-create": subscriptionCreate({
    subscriptionCode: "SUB_replace_me",
    emailToken: "token_replace_me",
    planCode: "PLN_replace_me",
    amount: 3_000_000,
    customer,
    nextPaymentDate: "2026-02-01T10:00:00.000Z",
  }),
  "invoice-create": invoiceEvent({
    event: "invoice.create",
    invoiceCode: "INV_replace_me",
    subscriptionCode: "SUB_replace_me",
    amount: 3_000_000,
    status: "pending",
    paid: false,
    customer,
    periodStart: "2026-02-01T10:00:00.000Z",
    periodEnd: "2026-03-01T10:00:00.000Z",
  }),
  "invoice-payment-failed": invoiceEvent({
    event: "invoice.payment_failed",
    invoiceCode: "INV_replace_me",
    subscriptionCode: "SUB_replace_me",
    amount: 3_000_000,
    status: "failed",
    paid: false,
    customer,
    periodStart: "2026-02-01T10:00:00.000Z",
    periodEnd: "2026-03-01T10:00:00.000Z",
  }),
  "subscription-not-renew": subscriptionStatusEvent({
    event: "subscription.not_renew",
    subscriptionCode: "SUB_replace_me",
    status: "non-renewing",
    planCode: "PLN_replace_me",
    customer,
  }),
  "subscription-disable": subscriptionStatusEvent({
    event: "subscription.disable",
    subscriptionCode: "SUB_replace_me",
    status: "complete",
    planCode: "PLN_replace_me",
    customer,
  }),
};
for (const [name, payload] of Object.entries(fixtures)) {
  writeFileSync(
    new URL(`./fixtures/${name}.json`, import.meta.url),
    `${JSON.stringify(payload, null, 2)}\n`
  );
}
console.log(`wrote ${Object.keys(fixtures).length} fixtures`);

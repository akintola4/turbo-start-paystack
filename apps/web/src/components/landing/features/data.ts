/** The six features, shared by every layout option. Code excerpts are real
 *  lines from the files named in `path` (trimmed, never rewritten). */

export type FeatureId =
  | "roles"
  | "checkout"
  | "proration"
  | "grace"
  | "money"
  | "mock";

export type Feature = {
  id: FeatureId;
  title: string;
  short: string;
  path: string;
  code: string;
};

export const REPO = "https://github.com/akintola4/turbo-start-paystack";

export const FEATURES: Feature[] = [
  {
    id: "roles",
    title: "Organizations and roles",
    short:
      "Five roles per organization. Members never see money; viewers can't change a thing.",
    path: "packages/auth/src/roles.ts",
    code: `admin: ac.newRole({
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  // Admins see billing but cannot spend money.
  billing: ["view"],
}),
billing: ac.newRole({
  billing: ["view", "manage"],
}),`,
  },
  {
    id: "checkout",
    title: "Checkout on Paystack",
    short:
      "Your server sets the amount. The browser only ever gets an access code.",
    path: "packages/billing/src/service/checkout.ts",
    code: `const amount =
  kind === "trial"
    ? TOKENIZATION_AMOUNT[price.currency]
    : price.amountSubunit;

const init = await deps.paystack.initializeTransaction({
  email: customer.email,
  amount,
  currency: price.currency,
  reference,`,
  },
  {
    id: "proration",
    title: "Trials, upgrades, downgrades",
    short:
      "Upgrades charge the difference for the days left. Downgrades wait for renewal.",
    path: "packages/billing/src/proration.ts",
    code: `const credit = Math.round(input.oldAmount * remainingFraction);
const cost = Math.round(newAmountForPeriod * remainingFraction);
return {
  remainingFraction,
  credit,
  cost,
  charge: Math.max(0, cost - credit),
};`,
  },
  {
    id: "grace",
    title: "Failed renewals",
    short: "Seven days of grace and one banner with one fix, then Free.",
    path: "packages/billing/src/reconcile.ts",
    code: `const overdue = await deps.db
  .select()
  .from(schema.subscription)
  .where(
    and(
      eq(schema.subscription.status, "past_due"),
      lt(schema.subscription.graceUntil, now)
    )
  )`,
  },
  {
    id: "money",
    title: "Integer money",
    short:
      "Every amount is stored in subunits, and one formatter prints it for the app and the email.",
    path: "packages/billing/src/money.ts",
    code: `export function formatMoney(amountSubunit: number, currency: string): string {
  if (!Number.isInteger(amountSubunit)) {
    throw new Error("amountSubunit must be an integer number of subunits");
  }
  const amount = amountFormat.format(Math.abs(amountSubunit) / 100);
  const sign = amountSubunit < 0 ? "\\u2212" : "";`,
  },
  {
    id: "mock",
    title: "Local Paystack mock",
    short:
      "Checkout and signed webhooks on your machine, without a Paystack account.",
    path: "scripts/paystack-mock.ts",
    code: `async function sendWebhook(payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": signPaystackPayload(body, SECRET),
    },
    body,
  });`,
  },
];

export const fileUrl = (path: string) => `${REPO}/blob/main/${path}`;

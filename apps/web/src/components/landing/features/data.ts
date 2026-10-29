/**
 * The six features, Paystack-specific gaps first. Code excerpts are real
 * lines from the files named in `path`: trimmed, and where lines are skipped
 * a `// …` line marks the gap. Never rewritten.
 */

export type FeatureId =
  | "proration"
  | "swaps"
  | "ordering"
  | "grace"
  | "roles"
  | "mock";

export type Feature = {
  id: FeatureId;
  title: string;
  short: string;
  path: string;
  code: string;
};

export const FEATURES: Feature[] = [
  {
    id: "proration",
    title: "Proration on upgrades",
    short:
      "Paystack has no proration. Upgrades charge the difference for the days left; downgrades wait for renewal.",
    path: "packages/billing/src/proration.ts",
    code: `export function computeProration(input: ProrationInput): Proration {
  const total = input.periodEnd.getTime() - input.periodStart.getTime();
  const left = input.periodEnd.getTime() - input.now.getTime();
  const remainingFraction =
    total <= 0 ? 0 : Math.min(1, Math.max(0, left / total));
  const newAmountForPeriod =
    input.newAmount *
    (nominalDays(input.oldInterval) / nominalDays(input.newInterval));
  const credit = Math.round(input.oldAmount * remainingFraction);
  const cost = Math.round(newAmountForPeriod * remainingFraction);
  return {
    remainingFraction,
    credit,
    cost,
    charge: Math.max(0, cost - credit),
  };
}`,
  },
  {
    id: "swaps",
    title: "Safe plan swaps",
    short:
      "Paystack can't change a subscription's plan. The starter creates the new one first, then retires the old one, so a failure never leaves a customer with nothing.",
    path: "packages/billing/src/service/switch-plan.ts",
    code: `let created: Awaited<ReturnType<typeof deps.paystack.createSubscription>>;
try {
  created = await deps.paystack.createSubscription({
    customer: customer.paystackCustomerCode,
    plan: row.paystackPlanCode,
    authorization: input.authorizationCode,
    start_date: startDate.toISOString(),
  });
} catch (error) {
// …
if (sub.paystackSubscriptionCode) {
  await retireSubscription(
    deps,
    tx,
    sub.organizationId,
    sub.paystackSubscriptionCode,
    sub.paystackEmailToken
  );
}`,
  },
  {
    id: "ordering",
    title: "Events in order",
    short:
      "Paystack can deliver events out of order. Each customer's events run one at a time, and the old plan's disable after a swap is not read as a cancellation.",
    path: "packages/billing/src/webhook/handlers.ts",
    code: `export async function dispatchEvent(
  deps: BillingDeps,
  tx: DbOrTx,
  event: string,
  data: unknown
): Promise<Outcome> {
  await lockCustomer(tx, customerCodeOf(data));
// …
  const code = data.subscription_code;
  const replaced = await isReplacedCode(tx, code);
  if (replaced) {
    // We retired this one during a plan change. Not a cancellation.
    if (event === "subscription.disable" && !replaced.disabledAt) {
      await tx
        .update(schema.replacedSubscription)
        .set({ disabledAt: deps.now() })
        .where(eq(schema.replacedSubscription.paystackSubscriptionCode, code));
    }
    return {};
  }`,
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
  )
  .limit(200);
for (const sub of overdue) {
  await step(\`past_due \${sub.id}\`, async () => {
    if (sub.paystackSubscriptionCode) {
      const token = await emailTokenFor(
        deps,
        sub.paystackSubscriptionCode,
        sub.paystackEmailToken
      ).catch(() => null);`,
  },
  {
    id: "roles",
    title: "Organizations and roles",
    short:
      "Five roles per organization. Members never see money; viewers can't change a thing.",
    path: "packages/auth/src/roles.ts",
    code: `admin: ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["read"],
  // Admins see billing but cannot spend money. Give them "manage" here if
  // your customers expect it.
  billing: ["view"],
}),
billing: ac.newRole({
  billing: ["view", "manage"],
  ac: ["read"],
}),
member: ac.newRole({
  ac: ["read"],
}),`,
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
  });
  console.log(
    \`webhook \${(payload as { event: string }).event} → \${res.status}\`
  );`,
  },
];

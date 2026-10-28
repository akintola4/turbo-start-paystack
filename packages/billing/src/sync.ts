import { type Database, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import { getPlan, listPlanPrices, type PlanPrice } from "./catalog";
import type { Currency } from "./money";
import type { PaystackClient } from "./paystack/client";

export type SyncReport = {
  created: string[];
  adopted: string[];
  unchanged: string[];
};

/** Paystack plan name. The `[id]` tag lets a fresh database adopt plans that
 *  already exist on the account instead of creating duplicates. */
export function paystackPlanName(price: PlanPrice): string {
  const plan = getPlan(price.planKey);
  return `${plan?.name ?? price.planKey} ${price.interval} ${price.currency} [${price.id}]`;
}

/**
 * `pnpm billing:sync`: one Paystack plan per catalog price. Creates what is
 * missing, adopts what already exists, and refuses to change an amount in
 * place (existing subscriptions keep their plan code; add a new price id).
 */
export async function syncPlans(input: {
  db: Database;
  paystack: PaystackClient;
  currencies?: Currency[];
  prices?: PlanPrice[];
}): Promise<SyncReport> {
  const prices = (input.prices ?? listPlanPrices()).filter(
    (p) => !input.currencies || input.currencies.includes(p.currency)
  );
  const report: SyncReport = { created: [], adopted: [], unchanged: [] };
  const remote = await input.paystack.listPlans();

  for (const price of prices) {
    const [row] = await input.db
      .select()
      .from(schema.planPrice)
      .where(eq(schema.planPrice.id, price.id));
    if (row?.paystackPlanCode) {
      if (row.amountSubunit !== price.amountSubunit) {
        throw new Error(
          `${price.id} is ${row.amountSubunit} in the database but ${price.amountSubunit} in the catalog. Paystack plan amounts are not changed in place; add a new price id instead.`
        );
      }
      report.unchanged.push(price.id);
      continue;
    }
    const name = paystackPlanName(price);
    const existing = remote.find(
      (p) =>
        p.name === name &&
        p.amount === price.amountSubunit &&
        p.currency === price.currency &&
        p.interval === price.interval
    );
    const code =
      existing?.plan_code ??
      (
        await input.paystack.createPlan({
          name,
          amount: price.amountSubunit,
          interval: price.interval,
          currency: price.currency,
          description: getPlan(price.planKey)?.description,
          send_invoices: true,
          send_sms: false,
        })
      ).plan_code;
    (existing ? report.adopted : report.created).push(price.id);
    await input.db
      .insert(schema.planPrice)
      .values({
        id: price.id,
        planKey: price.planKey,
        interval: price.interval,
        currency: price.currency,
        amountSubunit: price.amountSubunit,
        paystackPlanCode: code,
      })
      .onConflictDoUpdate({
        target: schema.planPrice.id,
        set: { paystackPlanCode: code, active: true },
      });
  }
  return report;
}

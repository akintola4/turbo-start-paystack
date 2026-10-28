import { type Currency, isCurrency } from "./money";

export type PlanKey = "free" | "starter" | "pro";
export type Interval = "monthly" | "annually";

export type PlanPriceDefinition = {
  interval: Interval;
  currency: Currency;
  /** Integer subunits (kobo, pesewas, cents). */
  amountSubunit: number;
};

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  description: string;
  /** Higher rank = bigger plan. Decides upgrade vs downgrade. */
  rank: number;
  trialDays: number;
  limits: { members: number };
  features: string[];
  prices: PlanPriceDefinition[];
};

const monthlyAndAnnual = (
  amounts: Partial<Record<Currency, [monthly: number, annually: number]>>
): PlanPriceDefinition[] =>
  Object.entries(amounts).flatMap(([currency, pair]) => {
    if (!(pair && isCurrency(currency))) {
      return [];
    }
    return [
      { interval: "monthly" as const, currency, amountSubunit: pair[0] },
      { interval: "annually" as const, currency, amountSubunit: pair[1] },
    ];
  });

/**
 * The source of truth for plans and prices. `pnpm billing:sync` creates one
 * Paystack plan per (plan × interval × currency) and stores its code.
 *
 * Never change an existing amount in place: Paystack subscriptions keep the
 * plan code they were created with. Add a new plan key or interval instead.
 */
export const catalog: PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    description: "For trying things out.",
    rank: 0,
    trialDays: 0,
    limits: { members: 3 },
    features: ["Up to 3 members"],
    prices: [],
  },
  {
    key: "starter",
    name: "Starter",
    description: "For small teams.",
    rank: 1,
    trialDays: 14,
    limits: { members: 10 },
    features: ["Up to 10 members", "Email support"],
    prices: monthlyAndAnnual({
      NGN: [1_000_000, 10_000_000],
      GHS: [15_000, 150_000],
      ZAR: [18_000, 180_000],
      KES: [130_000, 1_300_000],
      USD: [1000, 10_000],
    }),
  },
  {
    key: "pro",
    name: "Pro",
    description: "For growing companies.",
    rank: 2,
    trialDays: 14,
    limits: { members: 50 },
    features: ["Up to 50 members", "Priority support"],
    prices: monthlyAndAnnual({
      NGN: [3_000_000, 30_000_000],
      GHS: [45_000, 450_000],
      ZAR: [54_000, 540_000],
      KES: [390_000, 3_900_000],
      USD: [3000, 30_000],
    }),
  },
];

export const FREE_PLAN: PlanDefinition = catalog[0] as PlanDefinition;

export type PlanPrice = PlanPriceDefinition & {
  id: string;
  planKey: PlanKey;
};

export function planPriceId(
  planKey: PlanKey,
  interval: Interval,
  currency: Currency
): string {
  return `${planKey}-${interval}-${currency.toLowerCase()}`;
}

export function listPlanPrices(): PlanPrice[] {
  return catalog.flatMap((plan) =>
    plan.prices.map((price) => ({
      ...price,
      planKey: plan.key,
      id: planPriceId(plan.key, price.interval, price.currency),
    }))
  );
}

export function getPlanPrice(id: string): PlanPrice | undefined {
  return listPlanPrices().find((price) => price.id === id);
}

export function getPlan(key: string): PlanDefinition | undefined {
  return catalog.find((plan) => plan.key === key);
}

const NOMINAL_DAYS: Record<Interval, number> = { monthly: 30, annually: 365 };

export function nominalDays(interval: Interval): number {
  return NOMINAL_DAYS[interval];
}

/** Adds one billing interval using calendar months, as Paystack does. */
export function addInterval(date: Date, interval: Interval): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + (interval === "monthly" ? 1 : 12));
  return next;
}

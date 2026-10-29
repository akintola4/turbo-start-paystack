import type { Currency } from "@workspace/billing/money";

export type PlanKey = "free" | "starter" | "pro";

/** Monthly and annual amounts in subunits, per paid plan and currency. */
export type PriceTable = Record<
  Currency,
  Record<"starter" | "pro", { monthly: number; annually: number }>
>;

export type PlanInfo = {
  key: PlanKey;
  name: string;
  description: string;
  trialDays: number;
  features: string[];
};

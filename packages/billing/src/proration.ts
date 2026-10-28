import { type Interval, nominalDays } from "./catalog";

export type ProrationInput = {
  /** Amount of the current plan for its own interval, in subunits. */
  oldAmount: number;
  oldInterval: Interval;
  /** Amount of the target plan for its own interval, in subunits. */
  newAmount: number;
  newInterval: Interval;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
};

export type Proration = {
  remainingFraction: number;
  /** Unused value of the current plan for the rest of this period. */
  credit: number;
  /** Value of the new plan for the rest of this period. */
  cost: number;
  /** What to charge now: max(0, cost − credit). */
  charge: number;
};

/**
 * Paystack has no proration. On an immediate upgrade we charge the difference
 * for the time left in the current period, then start the new Paystack
 * subscription at the current period end.
 *
 * Interval changes are normalised to the current period: the new plan's price
 * is scaled by nominal days (30 for monthly, 365 for annual).
 */
export function computeProration(input: ProrationInput): Proration {
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
}

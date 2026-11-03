# Add or change a plan or price

Plans and prices live in one place, `packages/billing/src/catalog.ts`.
`pnpm billing:sync` creates one Paystack plan per plan, interval and currency
and stores its code in `plan_price`.

**Never edit an existing amount.** Paystack subscriptions keep the plan code
they were created on, and sync refuses an amount that differs from the
database. To change a price, add a plan with a new key (for example
`pro-2027`) and stop offering the old one.

## Files

- `packages/billing/src/catalog.ts`: `PlanKey`, and the entry in `catalog`
- `packages/billing/test/money-catalog-crypto.test.ts`: catalog tests
- The landing page names its plans in a few places, and `pnpm check-types`
  fails until they know the new key:
  - `apps/web/src/components/landing/types.ts` (`PlanKey`, `PriceTable`)
  - `apps/web/src/components/landing/landing.tsx` (`PaidPlan`, `priceTable()`)
  - `apps/web/src/components/landing/pricing.tsx` (the `md:grid-cols-3`
    grid, and the trial footnote under it)
- `apps/web/src/components/billing/plan-picker.tsx` reads plans from the
  catalog. Its grid is `@3xl:grid-cols-3`, so a fourth plan wraps
- `README.md` if the plan list or the roles/limits table changes

## Steps

1. Add the key to `PlanKey` and an entry to `catalog`:

   ```ts
   {
     key: "team",
     name: "Team",
     description: "For teams that outgrow Starter.",
     rank: 2,               // order only, never stored: renumber the others to fit
     trialDays: 14,         // 0 for no trial
     limits: { members: 25 },
     features: ["Up to 25 members", "Email support"],
     prices: monthlyAndAnnual({
       NGN: [2_000_000, 20_000_000],   // ₦20,000 / month, ₦200,000 / year, in kobo
       // add GHS, ZAR, KES, USD too: the landing page throws if one is missing
     }),
   },
   ```

   - Amounts are integer subunits (kobo, pesewas, cents): ₦20,000 is
     `2_000_000`. Don't write `20000 * 100` or divide anywhere.
   - `rank` decides upgrade (now, prorated) versus downgrade (at period end).
     A bigger plan needs a higher rank. Ranks are only compared, so moving
     Pro from 2 to 3 to fit Team in is safe.
   - Each amount must be at least Paystack's minimum for its currency:
     NGN ₦50 (`5000`), USD $2 (`200`), GHS ₵0.10 (`10`), ZAR R1 (`100`),
     KES Ksh3 (`300`).
   - The annual price is ten times the monthly one by convention (the
     landing page says "2 months free").
2. Update the landing files above so they know the key and show the plan.
3. Add tests to `packages/billing/test/money-catalog-crypto.test.ts`: the new
   price id resolves (`getPlanPrice("team-monthly-ngn")?.amountSubunit`), the
   member limit is right, and the rank sits where you meant
   (`planChangeKind` from Starter to Team is `"upgrade"`, and from Pro to
   Team is `"downgrade"`). The existing test already checks that every
   amount is a positive integer and that ids are unique.
4. Create the plans. Sync talks to whatever `PAYSTACK_API_URL` says, so on
   the mock the mock has to be running (`pnpm dev`, or `pnpm paystack:mock`
   in another shell):

   ```bash
   pnpm billing:sync                     # BILLING_CURRENCY only (NGN by default)
   pnpm billing:sync --currencies=NGN,USD
   ```

   It prints `created: team-monthly-ngn, team-annually-ngn`. Run it again and
   both show under `unchanged`. On Vercel, `vercel-build` runs it on every
   deploy.

## Verify

```bash
pnpm lint && pnpm check-types && pnpm test
```

With `pnpm dev` running on the mock, sign in as `ada@kolalogistics.test`,
open Billing and check the new plan's price, seats and trial. Start it,
press "Pay with test card" on the mock checkout, and you land back on Billing
with the plan in trial. "End the trial" in the Simulate billing panel charges
the first period. If the org is already on a plan, the picker offers an
upgrade or a downgrade, depending on the rank.

If `check-types` fails in `apps/web/src/components/landing/*`, step 2 is
missing a key.

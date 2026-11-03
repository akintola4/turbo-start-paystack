# Add or change a plan or price

Plans and prices live in one place, `packages/billing/src/catalog.ts`.
`pnpm billing:sync` creates one Paystack plan per plan, interval and currency
and stores its code in `plan_price`.

**Never edit an existing amount.** Paystack subscriptions keep the plan code
they were created on, and sync refuses an amount that differs from the
database. To change a price, add a plan with a new key (for example
`pro-2027`) and stop offering the old one.

## Files

- `packages/billing/src/catalog.ts`: `PlanKey`, and the entry in `catalog`.
  Pages list plans in array order, so put the entry where it should show
  (usually sorted by price)
- `packages/billing/test/money-catalog-crypto.test.ts`: catalog tests
- The landing page names its plans in a few places, and `pnpm check-types`
  fails until they know the new key:
  - `apps/web/src/components/landing/types.ts` (`PlanKey`, `PriceTable`)
  - `apps/web/src/components/landing/landing.tsx` (`PaidPlan`, `priceTable()`)
  - `apps/web/src/components/landing/pricing.tsx`: the `md:grid-cols-3`
    grid (with four plans, `md:grid-cols-2 xl:grid-cols-4` keeps rows even),
    the trial footnote under it, and `SUGGESTED = "pro"`, the plan with the
    filled button
- `apps/web/src/components/billing/plan-picker.tsx` reads plans from the
  catalog. Its grid is `@3xl:grid-cols-3`, so a fourth plan wraps onto a
  second row (`@3xl:grid-cols-2 @6xl:grid-cols-4` fixes it). Update the
  comment above the grid ("Three across only when…") to match. The annual
  "Save" note reads Pro's saving (`p.key === "pro"`). Change that only if
  you remove or rename Pro
- `apps/web/src/components/landing/features/demos.tsx` hand-types
  `priceOf(key: "starter" | "pro")` for the landing demos. A new plan needs
  nothing there; renaming or retiring Starter or Pro does
- `README.md` has no plan table. It names Pro in the e2e section and in
  screenshot alt text, so it needs a change only if you rename or remove
  Pro (`apps/web/e2e/setup.setup.ts` subscribes to Pro too)
- Renaming or retiring Starter or Pro also touches the copy in
  `apps/web/src/server/dev-billing.ts` ("Subscribe to Starter or Pro
  first"), the e2e specs that name them (`settings.spec.ts`,
  `command-palette.spec.ts`, and `numbers.spec.ts`, which expects "30,000
  naira per month"), and the billing tests, whose harness defaults to
  `pro-monthly-ngn`. Adding a plan touches none of these

## Steps

1. Add the key to `PlanKey` and an entry to `catalog`. Here Team sits
   between Starter (rank 1) and Pro, so Pro moves from rank 2 to 3:

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
       GHS: [30_000, 300_000],         // and ZAR, KES, USD: the landing page throws if one is missing
     }),
   },
   ```

   - Amounts are integer subunits (kobo, pesewas, cents): ₦20,000 is
     `2_000_000`. Don't write `20000 * 100` or divide anywhere.
   - `rank` decides upgrade (now, prorated) versus downgrade (at period end).
     A bigger plan needs a higher rank. Ranks are only compared, so moving
     Pro from 2 to 3 to fit Team in is safe.
   - `limits.members` should go up with rank (Starter 10, Team 25, Pro 50),
     so an upgrade never takes seats away and a downgrade's seat check
     means what it says.
   - Each amount must be at least Paystack's minimum for its currency:
     NGN ₦50 (`5000`), USD $2 (`200`), GHS ₵0.10 (`10`), ZAR R1 (`100`),
     KES Ksh3 (`300`).
   - The annual price is ten times the monthly one by convention (the
     landing page says "2 months free").
   - Other currencies: unless you were given prices, scale the nearest
     existing plan by the same ratio as the NGN price. Team at ₦20,000 is
     twice Starter's ₦10,000, so it's twice Starter everywhere (GHS
     `30_000`, ZAR `36_000`, KES `260_000`, USD `2000` a month). Say in your
     summary that these were derived, so a person can set real prices.
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
pnpm e2e    # the plan picker and landing pricing are covered by specs
```

Two specs cover plans: `e2e/landing.spec.ts` (the landing page and its
pricing) and `e2e/setup.setup.ts` (subscribes through the plan picker, and
runs at the start of every `pnpm e2e`). `pnpm e2e e2e/landing.spec.ts` runs
one. Run `pnpm --filter web exec playwright install chromium` once first.

With `pnpm dev` running on the mock, sign in as `ada@kolalogistics.test` and
open Billing (`/app/kola-logistics/settings/billing`). Right after a reload
the page can show a skeleton for a moment (its screen-reader label is
"Loading billing"); wait for the plans. The seeded org is on Free. Check the
new plan's price, seats and trial, then start it. The mock checkout charges
₦50, not the plan price: on a plan with a trial, the first charge is a
refunded card check, and the subscription starts when the trial ends. Press
"Pay with test card" and you land back on Billing with the plan in trial.
Now that the org is on a paid plan, the picker should offer a downgrade to
smaller plans and an upgrade to bigger ones, which confirms the rank. "End
the trial" in the Simulate billing panel charges the first period and
issues an invoice for the full price. Invoices are listed on the Invoices
page (`/app/kola-logistics/settings/billing/invoices`), not on Billing.

If `check-types` fails in `apps/web/src/components/landing/*`, step 2 is
missing a key.

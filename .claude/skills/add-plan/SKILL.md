---
name: add-plan
description: Add, reprice or retire a subscription plan in turbo-start-paystack (packages/billing/src/catalog.ts, then pnpm billing:sync). Use when asked to "add a plan", "add a Team/Enterprise tier", "change the price", "add a currency", "change seat limits" or "make a plan annual", or when editing catalog.ts.
---

# Add or change a plan

Follow `docs/agents/add-plan.md` step by step. It is the source of truth, and
this skill only adds the guard rails that are easy to get wrong.

Before you edit:

1. Read `docs/agents/add-plan.md` and the `catalog` array in
   `packages/billing/src/catalog.ts`.
2. If the request changes an existing price: don't edit the amount. Add a
   new plan key and stop offering the old one. `pnpm billing:sync` refuses
   in-place changes, because live subscriptions keep their plan code.

While editing:

- Amounts are integer subunits: ₦20,000 is `2_000_000`. Never divide, and
  never multiply at runtime.
- Each amount must be at least the Paystack minimum: NGN `5000`, USD `200`,
  GHS `10`, ZAR `100`, KES `300`.
- `rank` sets upgrade versus downgrade. Renumber the others so the order
  matches the price.
- A new key has to go into the landing page types
  (`apps/web/src/components/landing/types.ts` and `landing.tsx`), or
  `pnpm check-types` fails. `pricing.tsx` (grid, trial footnote,
  `SUGGESTED`) and the plan-picker grid in
  `apps/web/src/components/billing/plan-picker.tsx` are layout only: update
  them so a fourth plan doesn't wrap.
- Member limits go up with rank.

Finish:

```bash
pnpm billing:sync      # with the mock running (pnpm dev or pnpm paystack:mock)
pnpm lint && pnpm check-types && pnpm test
pnpm e2e               # landing.spec.ts and setup.setup.ts cover plans
```

Then report the new price ids that sync printed under `created:`, and check
the plan on the Billing page as `ada@kolalogistics.test`.

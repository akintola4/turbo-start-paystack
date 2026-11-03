# Go live: test keys to live keys

Going live means changing keys in production. The code doesn't change. Do
it only once the deployment works end to end in test mode
([deploy-vercel.md](deploy-vercel.md)). Only the person can switch the
Paystack account to live and paste live keys, so an agent prepares the
checklist and checks the results.

Test and live are separate worlds on Paystack: different keys, plan codes,
customers, subscriptions and webhook URLs. Nothing carries over.

## Before switching

- [ ] Every item in `docs/paystack-verification.md` was checked in test mode
      against a real test account, and any difference was fixed in the fake
      and fixtures first.
- [ ] The Paystack business is activated for live payments in
      `BILLING_CURRENCY` and in every currency you sync with
      `pnpm billing:sync --currencies=…` (USD may need approval).
- [ ] Catalog prices are final and at least each currency's minimum. A live
      price can't be edited later, only replaced with a new plan key
      ([add-plan.md](add-plan.md)).
- [ ] Prices are VAT-inclusive. If you charge VAT, set `INVOICE_VAT_RATE`
      and the `INVOICE_SELLER_*` details. VAT isn't added to the charge.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` work on a verified domain, and
      `EMAIL_TRANSPORT` is unset or `resend` (`log` only prints emails).
- [ ] Production `BILLING_ENCRYPTION_KEY` is backed up somewhere other than
      Vercel.

## The switch

1. Use a fresh production database (a new Neon branch, migrated) for live
   mode. This is required, not a convenience: `billing:sync` skips every
   `plan_price` row that already has a plan code, so a kept database keeps
   its test-mode plan codes, and live checkouts would use plans live mode
   doesn't know. Test subscriptions there point at test-mode codes too.
2. In Vercel Production, set `PAYSTACK_SECRET_KEY=sk_live_…` and
   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_…`. Leave `PAYSTACK_API_URL`
   unset. The dev Simulate billing routes refuse `sk_live_` keys in any case.
3. Redeploy. `vercel-build` runs `billing:sync` with the live key, so the
   log should say `(LIVE mode)` and list `created:` for every price. If it
   lists them under `unchanged:` instead, stop: the database still holds
   test-mode plan codes (step 1).
4. In the Paystack dashboard, in **live** mode, set the webhook URL to
   `https://<domain>/api/webhooks/paystack` and the callback URL to
   `https://<domain>/billing/callback`.
5. Leave `PAYSTACK_WEBHOOK_IP_ALLOWLIST` off unless you've checked that the
   host passes the real client IP. On Vercel, `CLIENT_IP_HEADER` defaults
   to `x-vercel-forwarded-for`.

## After switching

- [ ] One real subscription on the smallest plan with a real card. A
      `charge.success` and a `subscription.create` row land in
      `webhook_event` with `processed_at` set, an invoice gets a number,
      and the receipt email arrives.
- [ ] Cancel it from Billing. The status goes to non-renewing and access
      stays until the period end. Refund the charge from the Paystack
      dashboard. The refund webhooks update the invoice.
- [ ] `GET /api/cron/billing-reconcile` with the bearer token returns
      `"errors":[]`, and the GitHub "Billing reconcile" workflow runs green
      every hour.
- [ ] Watch the logs for `webhook processing failed` for the first few days
      ([debug-webhook.md](debug-webhook.md)).

`docs/paystack-setup.md` ("Going live") has the short version of this list.

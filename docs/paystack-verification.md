# Paystack test-mode checklist

No real Paystack keys were used to build this starter. The billing code was
tested against an in-memory fake (`packages/billing/src/fake-paystack.ts`) and
webhook payloads built from Paystack's documented examples
(`packages/billing/src/fixtures.ts`). Everything below needs confirming with a
real test-mode account before going live. If Paystack behaves differently,
change the fake and the fixtures first so a test fails, then fix the code.

Set up: test keys in `apps/web/.env`, a tunnel to your machine as the webhook
URL, `pnpm billing:sync`, and watch the `webhook_event` table.

## Plans and sync

- [ ] `POST /plan` accepts `interval: "monthly"` and `"annually"` for every
      currency you enable.
- [ ] `GET /plan?perPage=100` returns all plans (sync adopts them by name).
- [ ] Your account can use each currency in `BILLING_CURRENCY` (USD may need
      approval).

## Checkout

- [ ] `POST /transaction/initialize` with `plan` charges the plan amount, and
      the `charge.success` amount equals the catalog amount exactly. The
      handler rejects any mismatch.
- [ ] `metadata` comes back in `charge.success` and in
      `GET /transaction/verify` (as an object or a JSON string; both are
      handled, and `""` or `0` read as no metadata).
- [ ] The `plan` field on a one-off charge (the trial card check): `{}`,
      `null`, `0` or a numeric id are all read as "no plan".
- [ ] The callback URL receives `?reference=` (and `trxref=`).
- [ ] `@paystack/inline-js` 2.27 `resumeTransaction(accessCode, { onSuccess })`
      opens the popup and calls `onSuccess`.
- [ ] `GET /transaction/verify` for an unpaid reference returns
      `status: "abandoned"`, and for an unknown reference a 4xx (treated as
      abandoned by reconcile).
- [ ] A declined card sends no webhook (reconcile is relied on to expire it).

## Subscriptions

- [ ] After a plan checkout, both `charge.success` and `subscription.create`
      arrive, in either order, with `customer.customer_code` and
      `plan.plan_code`.
- [ ] `subscription.create` includes `email_token` and `next_payment_date`.
- [ ] `POST /subscription` with `authorization` and a future `start_date`
      returns `subscription_code` and `email_token`, and charges nothing until
      `start_date`. Its `plan` and `customer` are numeric ids, not objects
      (seen in production; the schemas accept both).
- [ ] A second `POST /subscription` for the same customer and plan fails
      with "This subscription is already in place." (seen in production).
      The billing code then adopts the existing one via `GET /customer/:code`
      and `GET /subscription?customer=<id>`; check that list returns
      `plan.plan_code` and `email_token`.
- [ ] On `start_date`, the first charge sends `charge.success` with the plan
      code and customer, and `GET /subscription/:code` then shows the next
      `next_payment_date`. Trials and scheduled downgrades depend on this.
- [ ] `POST /subscription/disable` and `/enable` return
      `{ status: true, message }` with no `data`.
- [ ] After disable: `subscription.not_renew` immediately, then
      `subscription.disable` on the next payment date.
- [ ] `/enable` works on a non-renewing subscription before its period ends.
- [ ] `GET /subscription/:code/manage/link` returns `{ link }`.
- [ ] Renewal `charge.success` carries `plan` and `customer` (no metadata).
      Organizations from before customers were per organization can share a
      customer: all of them on that plan get resynced, and the invoice goes
      to the one whose period moved.

## Customers

- [ ] `POST /customer` with an email Paystack already knows returns that
      customer (same `customer_code`) rather than an error. If it errors
      instead, the app fetches `GET /customer/:email` and adopts it.
- [ ] Paystack accepts plus-tagged addresses (`you+3f9a2c1b@gmail.com`) as
      customer emails, and its receipts for them land in the plain inbox.
- [ ] One person, two organizations, both on Starter: two customers, two
      active subscriptions, and both card checks refunded.

## Invoices and failures

- [ ] `invoice.create` arrives about 3 days before renewal with
      `invoice_code`, `subscription.subscription_code`, `period_start`,
      `period_end`, and is only ever stored as `pending`.
- [ ] A failing renewal sends `invoice.payment_failed`, then `invoice.update`
      with `status: "failed"` (use the declining test card on the
      subscription).
- [ ] Paystack's retry behaviour for a subscription in `attention` (the docs
      disagree). The starter assumes no retry and uses its grace period.
- [ ] `subscription.expiring_cards` payload shape (sent at month start).

## Recurring charges and refunds

- [ ] `POST /transaction/charge_authorization` with the saved authorization
      and the original email succeeds for upgrades.
- [ ] A 2FA card returns `paused: true` with an `authorization_url`, and the
      later `charge.success` uses our reference.
- [ ] `POST /refund { transaction: reference }` refunds the trial
      tokenisation charge; check the `refund.processed` payload field
      `transaction_reference`.
- [ ] Tokenisation amounts meet the documented minimums
      (https://paystack.com/docs/api/, supported currencies): NGN 50,
      GHS 0.10, ZAR 1, KES 3, USD 2. We charge KES 10.
- [ ] `authorization.reusable` is `true` for test card
      `4084 0840 8408 4081`.

## Webhooks

- [ ] The signature is the hex HMAC-SHA512 of the raw body with the secret
      key (a mismatched key gives 401 in the app log).
- [ ] Requests come from 52.31.139.75, 52.49.173.169 or 52.214.14.220 before
      turning on `PAYSTACK_WEBHOOK_IP_ALLOWLIST`. Behind a proxy, check that
      `x-forwarded-for` carries the client IP.
- [ ] Test-mode retry schedule after a non-200 (docs say hourly for 72h).

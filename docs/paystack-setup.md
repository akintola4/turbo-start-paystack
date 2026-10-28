# Paystack setup

## Keys

In the Paystack dashboard, Settings → API Keys & Webhooks:

- `PAYSTACK_SECRET_KEY`: the secret key (`sk_test_…` in test mode). The
  server uses it for API calls and to verify webhook signatures. Never expose
  it to the browser.
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: the public key (`pk_test_…`). Optional.
  With it, checkout opens Paystack's inline popup; without it, the browser is
  redirected to Paystack's hosted page.

## Webhook URL

Set the webhook URL for the mode you are in (test and live are separate):

```txt
https://<your-domain>/api/webhooks/paystack
```

For local development, expose port 3000 with a tunnel and use its URL:

```bash
cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000
```

Set `BETTER_AUTH_URL` to the same public URL while testing through the tunnel,
because it is also the base of the checkout callback URL.

Unsigned or wrongly signed requests get a 401. Every accepted event is stored
in `webhook_event`; `processed_at` and `error` show what happened to it.

Optional: `PAYSTACK_WEBHOOK_IP_ALLOWLIST=true` also rejects requests that are
not from Paystack's published IPs. Only turn it on once you have checked that
your host passes the real client IP in `x-forwarded-for`.

## Plans

Plans and prices live in `packages/billing/src/catalog.ts` (amounts in
subunits: kobo, pesewas, cents). Create them on Paystack with:

```bash
pnpm billing:sync                      # currencies from BILLING_CURRENCY
pnpm billing:sync --currencies=NGN,GHS
```

Run it once per environment: test key with your development database, live
key with your production database. Plan codes differ between test and live.

To change a price, add a new price (for example a new plan key) rather than
editing an amount. Sync refuses to change an amount in place, because
existing Paystack subscriptions keep the plan they were created on.

## Reconcile cron

Call this hourly:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/billing-reconcile
```

`apps/web/vercel.json` schedules it on Vercel (Vercel sends the bearer token
from `CRON_SECRET` automatically). On other hosts use any scheduler. It
returns a JSON report and is safe to run as often as you like.

## Replaying webhooks

```bash
pnpm webhook:replay scripts/fixtures/charge-success.json
pnpm webhook:replay my-payload.json --url=https://<tunnel>/api/webhooks/paystack
```

The script signs the payload with `PAYSTACK_SECRET_KEY`. Edit the fixture's
reference and codes to match rows in your database first. Regenerate the
fixtures from the typed builders with
`pnpm --filter @workspace/scripts exec tsx write-fixtures.ts`.

## Going live

- [ ] Work through `docs/paystack-verification.md` in test mode.
- [ ] Live keys in production env; live webhook URL set in the dashboard.
- [ ] `pnpm billing:sync` with the live key against the production database.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set; `EMAIL_TRANSPORT` not set.
- [ ] `BILLING_ENCRYPTION_KEY` generated for production and backed up.
      Losing it means losing the stored email tokens and card authorizations
      (cancel and upgrade would then need `GET /subscription/:code` and a new
      checkout).
- [ ] Reconcile cron running; check its report once after the first hour.
- [ ] Prices are tax-inclusive. VAT (NG 7.5%, ZA 15%, KE 16%) is not
      calculated for you.

# Deploy to Vercel and Neon

This is how the live demo runs. The full prose version is "Deploying" in
`README.md`. This page is the checklist an agent works through. Anything
that needs a dashboard (Vercel, Neon, Paystack, GitHub secrets) is the
person's to do: tell them the exact values, don't guess at them.

## What is already in the repo

- `apps/web/package.json` `vercel-build`, which Vercel runs instead of
  `build`:
  1. `pnpm db:migrate` with `DATABASE_URL_UNPOOLED` (falling back to
     `DATABASE_URL`), because migrations need a direct connection, not the
     pooler;
  2. `pnpm billing:sync` with the deployment's Paystack key, so the plans
     exist before the new build serves traffic;
  3. `next build`.
- `apps/web/vercel.json`: functions pinned to `fra1` (Frankfurt) and a daily
  cron at 03:00 UTC on `/api/cron/billing-reconcile`. Vercel sends
  `Authorization: Bearer $CRON_SECRET` itself.
- `.github/workflows/billing-reconcile.yml`: calls the same route every hour
  (at :17), because Vercel Hobby runs crons at most once a day. It skips
  until both repository secrets are set.

## Steps

1. **Import the repo** in Vercel and set Root Directory to `apps/web`. Leave
   the build command empty so `vercel-build` runs.
2. **Neon:** add it from the Vercel Marketplace and connect it to the
   project. It sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
   (direct). Create the database in `aws-eu-central-1` (Frankfurt) to sit
   next to `fra1`, or change `regions` in `apps/web/vercel.json`.
3. **Production environment variables:**

   | Variable | Value |
   |---|---|
   | `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | The public domain, e.g. `https://<project>.vercel.app`. Not a `…-git-…` deployment URL: those are behind Deployment Protection, so callbacks and email links would hit a Vercel login |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BILLING_ENCRYPTION_KEY` | `openssl rand -hex 32`. Back it up: losing it loses stored card authorizations and email tokens |
   | `CRON_SECRET` | `openssl rand -hex 16` or longer |
   | `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Test keys first (see [go-live.md](go-live.md)) |
   | `PAYSTACK_API_URL` | Leave unset |
   | `RESEND_API_KEY`, `EMAIL_FROM` | On a domain verified in Resend. In production a send without a key throws |
   | Optional | `BILLING_CURRENCY`, `INVOICE_SELLER_*`, `INVOICE_VAT_RATE`, `EMAIL_BRAND_NAME`, … (all in `.env.example`) |

   `NEXT_PUBLIC_*` values are inlined at build time, so redeploy after
   changing them. `packages/env/src/server.ts` validates the rest at boot.
4. **Deploy.** The build log shows the migrations, then
   `Syncing NGN plans to Paystack (test mode)…`, then `next build`.
5. **Paystack dashboard** (Settings, then API Keys & Webhooks, for the mode
   you're in):
   - Webhook URL: `https://<domain>/api/webhooks/paystack`
   - Callback URL: `https://<domain>/billing/callback`
6. **Hourly reconcile:** in GitHub, under Settings, Secrets and variables,
   Actions, add `APP_URL` (`https://<domain>`) and `CRON_SECRET` (the same
   value as in Vercel). Then run the "Billing reconcile" workflow once by
   hand. On Vercel Pro, change the `vercel.json` schedule to `0 * * * *`
   and delete the workflow instead.
7. **Preview deployments** need their own variables: a separate
   `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (a Neon branch), their own
   secrets and test keys. Never point a preview at the production database,
   because its build runs migrations. Paystack can't reach protected
   previews, so test billing locally on the mock.

## Verify

```bash
curl -sI https://<domain>/ | grep -i content-security-policy     # nonce CSP on pages
curl -s https://<domain>/llms.txt | head -3                      # static, served
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/billing-reconcile
# → {"eventsRetried":0,…,"errors":[]}
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<domain>/api/webhooks/paystack -d '{}'
# → 401 (unsigned)
```

Then sign up, create an organization, subscribe with test card
`4084 0840 8408 4081`, and check that a `webhook_event` row arrives with
`processed_at` set (Neon's SQL editor). If it doesn't, see
[debug-webhook.md](debug-webhook.md).

## Other hosts

Nothing depends on Vercel. Use a direct connection for
`DATABASE_URL=<direct> pnpm db:migrate`, then `pnpm billing:sync`,
`pnpm build` and `pnpm --filter web start`, and call the reconcile route
hourly from any scheduler.

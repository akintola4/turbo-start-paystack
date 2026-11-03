---
name: deploy-vercel
description: Deploy turbo-start-paystack to Vercel with Neon Postgres, or check an existing deployment, including vercel-build, DATABASE_URL_UNPOOLED, the fra1 region, crons, the GitHub reconcile workflow and the Paystack webhook and callback URLs. Use when asked to "deploy", "ship to Vercel", "set up production", "set up Neon", "why aren't webhooks arriving in prod", or before going live.
---

# Deploy to Vercel and Neon

Follow `docs/agents/deploy-vercel.md` as a checklist, and
`docs/agents/go-live.md` when switching to live keys.

Ground rules:

- Dashboards are the person's to change (Vercel, Neon, Paystack, GitHub
  secrets). Say exactly which variable or URL to set and to what. Never
  invent a value, and never print or commit a secret.
- Don't change the build command. Vercel runs `vercel-build` in
  `apps/web/package.json`: migrate on `DATABASE_URL_UNPOOLED`, then
  `billing:sync`, then `next build`.
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` are the public domain, never a
  protected `…-git-…` deployment URL.
- Region: `apps/web/vercel.json` pins `fra1`, so the Neon database belongs
  in `aws-eu-central-1`, or change `regions`.
- Reconcile has to run hourly: the daily Vercel cron, plus
  `.github/workflows/billing-reconcile.yml` with the `APP_URL` and
  `CRON_SECRET` repository secrets.
- Paystack dashboard, per mode: webhook
  `https://<domain>/api/webhooks/paystack`, callback
  `https://<domain>/billing/callback`.
- Previews get their own database and test keys, never production's.

Verify with the `curl` checks in `docs/agents/deploy-vercel.md` (reconcile
returns `"errors":[]`, an unsigned webhook gets 401), then one test-card
subscription. If webhooks don't land, follow `docs/agents/debug-webhook.md`.

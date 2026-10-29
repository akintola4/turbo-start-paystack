# Turbo Start Paystack

Turbo Start Paystack is an open-source SaaS starter for teams that bill in
Africa. It is a `pnpm` monorepo with Turborepo, a Next.js 16 app, Better Auth
organizations and roles, and Paystack subscriptions.

Billing state is written only by verified webhooks and server-side
verification. The browser never sends a plan status, an amount or a
subscription code.

## What is included

- `apps/web`: Next.js 16 App Router app with sign-up and sign-in,
  organizations, members and invitations, a billing page, the Paystack webhook
  route, the checkout callback and the reconcile cron route
- `packages/billing`: typed Paystack client, plan catalog, checkout, webhook
  verification and idempotent processing, proration, plan changes,
  cancel/resume, dunning state and the reconcile job. Pure TypeScript with
  its database and HTTP dependencies passed in
- `packages/auth`: Better Auth with the organization plugin, org-scoped roles
  (owner, admin, billing, member, viewer) and `requirePermission`
- `packages/db`: Drizzle schema for auth and billing tables, migrations, and
  test databases (PGlite, or a real Postgres for concurrency tests)
- `packages/email`: React Email templates and the sender (Resend over
  HTTP, or a log in development)
- `packages/ui`, `packages/env`, `packages/logger`, `packages/tailwind-config`,
  `packages/typescript-config`: shared UI (shadcn, new-york), env validation
  (t3-env), a logger that redacts tokens, and config
- `scripts`: `billing:sync`, a local Paystack mock, and a webhook replay tool

## Repo layout

```txt
apps/
  web/            Next.js app
packages/
  auth/           Better Auth config, roles, requirePermission
  billing/        Paystack billing domain (most of the tests live here)
  db/             Drizzle schema, migrations, test databases
  email/
  env/
  logger/
  tailwind-config/
  typescript-config/
  ui/
scripts/          billing:sync, paystack:mock, webhook:replay, fixtures/
docs/             decisions, Paystack setup, Paystack test-mode checklist
```

## Requirements

- Node.js 24 or newer
- pnpm 11 (`corepack enable` picks up the version in `package.json`)
- Postgres 15 or newer (Neon, Supabase, Railway or local)
- A Paystack account. Test keys are enough to start

## Getting started

### 1. Install

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example apps/web/.env
```

Fill in `apps/web/.env`. Every variable is listed in `.env.example`; the app
refuses to boot if a required one is missing or malformed.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | yes | Public URL of the app, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | no | Same as above, for the browser. Defaults to localhost |
| `PAYSTACK_SECRET_KEY` | yes | `sk_test_…` or `sk_live_…`. Also the webhook signing key |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | no | `pk_test_…`. Enables the inline popup; without it checkout redirects to Paystack |
| `PAYSTACK_API_URL` | no | Leave unset in production. Point at the local mock in development |
| `PAYSTACK_WEBHOOK_IP_ALLOWLIST` | no | `true` to also reject webhooks not from Paystack's IPs |
| `BILLING_ENCRYPTION_KEY` | yes | 64 hex chars (`openssl rand -hex 32`). Encrypts email tokens and card authorizations |
| `BILLING_CURRENCY` | no | `NGN` (default), `GHS`, `ZAR`, `KES` or `USD` |
| `BILLING_GRACE_DAYS` | no | Days a failed renewal keeps access. Default 7 |
| `BILLING_TRIAL_MODE` | no | `card` (default): card-up-front trials. `off`: no trials |
| `CRON_SECRET` | yes | 16+ chars. Bearer token for `/api/cron/billing-reconcile` |
| `EMAIL_FROM` | no | Sender, e.g. `Acme <billing@mail.acme.com>`. Its domain must be verified in Resend |
| `RESEND_API_KEY` | prod | Without it, emails are written to the server log (development only) |
| `EMAIL_TRANSPORT` | no | `log` lets a local `next start` log emails. Never set it on a real deployment |
| `EMAIL_BRAND_NAME` | no | Product name in email headers and footers. Default `Turbo Start` |
| `EMAIL_LOGO_URL` | no | https URL of a logo (shown 28px tall). Without it, the name is used as a wordmark |
| `EMAIL_SUPPORT_URL` | no | `https:` or `mailto:` link for "Contact support" in the footer |

### 3. Create the database

Use any Postgres. For a throwaway local one, `./scripts/dev-db.sh` starts
Postgres 17 (Docker, or a local install) and prints a `DATABASE_URL`.

```bash
DATABASE_URL=postgres://… pnpm db:migrate
```

### 4. Create the Paystack plans

```bash
pnpm billing:sync                     # BILLING_CURRENCY only
pnpm billing:sync --currencies=NGN,USD
```

This creates one Paystack plan per plan, interval and currency in
`packages/billing/src/catalog.ts` and stores the plan codes. It is safe to run
again. It never changes the amount of an existing plan; to change a price, add
a new price to the catalog.

### 5. Start the app

```bash
pnpm dev:web
```

Open `http://localhost:3000`, create an account, then an organization.

### Developing without Paystack keys

`pnpm paystack:mock` runs a local stand-in for `api.paystack.co` on port 4010
with a fake hosted checkout page. Set `PAYSTACK_API_URL=http://localhost:4010`
and `PAYSTACK_SECRET_KEY=sk_test_local_mock`, run `pnpm billing:sync`, then
subscribe from the billing page. The mock's "Pay" button sends signed
`charge.success` and `subscription.create` webhooks to the app, like Paystack
would. It is for development only and is not a Paystack simulator.

## Useful commands

```bash
pnpm dev:web           # Next.js app
pnpm email:preview     # React Email preview of every template on :3001
pnpm build             # build everything
pnpm lint              # Biome
pnpm format            # Biome format
pnpm check-types       # TypeScript
pnpm test              # Vitest in every package
pnpm db:generate       # new migration after a schema change
pnpm db:migrate        # apply migrations
pnpm billing:sync      # create Paystack plans from the catalog
pnpm paystack:mock     # local Paystack API + checkout page
pnpm webhook:replay scripts/fixtures/charge-success.json
```

## Tests

Most tests run against PGlite (Postgres in-process) with the Paystack API
replaced by an in-memory fake behind msw. No keys or services are needed:

```bash
pnpm test
```

Concurrency tests need a real Postgres server, because PGlite has a single
connection. They are skipped unless `TEST_DATABASE_URL` is set (CI sets it):

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres pnpm test
```

Webhook tests use payloads built from Paystack's documented examples
(`packages/billing/src/fixtures.ts`). Behaviour that still has to be confirmed
against real Paystack test mode is listed in `docs/paystack-verification.md`.

## Paystack dashboard setup

1. Settings → API Keys & Webhooks: copy the test secret and public keys into
   `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.
2. Set the webhook URL to `https://<your-domain>/api/webhooks/paystack`. For
   local development use a tunnel (`cloudflared tunnel --url
   http://localhost:3000` or `ngrok http 3000`) and paste its URL.
3. Run `pnpm billing:sync` with the test key, then again with the live key
   against your production database. Test and live plan codes differ.
4. Schedule `GET /api/cron/billing-reconcile` hourly with
   `Authorization: Bearer $CRON_SECRET`. `apps/web/vercel.json` does this on
   Vercel; elsewhere use any scheduler.

More detail, including a going-live checklist, is in `docs/paystack-setup.md`.

## Email

Emails are React Email templates in `packages/email/src/templates`. Each
send renders an HTML part and a plain-text part and posts both to Resend's
HTTP API. Without `RESEND_API_KEY`, development logs each email (and keeps
the last 50 in memory for the smoke test); in production a send without a
key throws, so mail is never silently dropped, unless `EMAIL_TRANSPORT=log`
is set.

| Template | Sent when |
|---|---|
| Verify email | Sign-up |
| Reset password | Password reset requested |
| Organization invitation | Someone is invited (inviter, organization, role, 7-day expiry) |
| Payment receipt | First checkout charge and each renewal |
| Payment failed | A renewal fails: grace-period end date and Paystack's update-card link |
| Trial ending | Reconcile, 3 days before a trial ends (once): date, plan and amount |
| Subscription cancelled | Cancelled in the app or on Paystack: access-until date and resume link |
| Plan changed | Upgrade (prorated amount charged now) or downgrade (scheduled for period end) |
| Trial started, card expiring, payment disputed | Paystack card-up-front trial starts, `subscription.expiring_cards`, `charge.dispute.create` |

Billing emails go to every member who can manage billing (owner and the
`billing` role), after the database change has committed.

### Resend setup

1. Create an API key in Resend (sending access is enough) and set
   `RESEND_API_KEY`.
2. Add and verify your sending domain in Resend (Domains → Add domain, then
   the SPF and DKIM DNS records it shows). A subdomain such as
   `mail.acme.com` keeps it separate from your main mail.
3. Set `EMAIL_FROM` to an address on that domain, e.g.
   `Acme <billing@mail.acme.com>`. Resend rejects sends from unverified
   domains with a 403, which the app logs.

### Design, branding and preview

Billing emails open on the app's forest money panel: plan and status, the
amount or deadline, and one action, with the details on a card below. Verify,
reset and invite use the same header, card and button without the panel.
Rationale and client behaviour (fonts, ₦/₵, dark mode, size) are in
`docs/decisions.md` #30; the research behind the design is in
`docs/email-research.md`.

Set `EMAIL_BRAND_NAME`, `EMAIL_LOGO_URL` and `EMAIL_SUPPORT_URL`, or edit the
colours in `packages/email/src/theme.ts` (one theme object: light, dark and
the forest panel). Emails load Geist, the ₦/₵ font subset and the status
icons from `apps/web/public/email`, served at `${BETTER_AUTH_URL}/email`, so
those files must be deployed with the app.

```bash
pnpm email:preview                                         # http://localhost:3001
pnpm --filter @workspace/email export /tmp/out             # every template as .html and .txt
pnpm --filter @workspace/email screenshots /tmp/shots      # light/dark, desktop/phone, client checks
pnpm --filter @workspace/email icons                       # regenerate the status icons
pnpm --filter @workspace/email send-test --to you@example.com --inline   # every template to a real inbox
```

The preview uses the sample props at the bottom of each template file.

`send-test` sends every template with its sample data through Resend, so you
can check it in Gmail, Outlook and Apple Mail in light and dark mode. It reads
`RESEND_API_KEY` and `EMAIL_FROM` from `apps/web/.env`. Without a verified
domain, Resend only delivers from `onboarding@resend.dev` to the address your
Resend account uses. Add `--only payment-receipt,payment-failed` to send a few.
Icons and fonts load from `EMAIL_TEST_ASSETS_URL` (or `--assets-url`), which
must be a public URL such as a preview deploy's `/email`. Before anything is
deployed, pass `--inline`: the status icons are attached to each message and
referenced by Content-ID, so they show without hosting, and the fonts fall back
to Helvetica/Arial, as they do in Gmail anyway. Mail sent from
`onboarding@resend.dev` often lands in spam; a verified domain with SPF and
DKIM fixes that.

<p>
  <img alt="Payment receipt email, light mode" src="docs/images/email-receipt-light.png" width="380">
  <img alt="Payment failed email, dark mode on a phone" src="docs/images/email-payment-failed-dark-mobile.png" width="240">
</p>

## Roles

Roles belong to a membership in one organization. There is no global admin.

| Permission | owner | admin | billing | member | viewer |
|---|---|---|---|---|---|
| Update organization | yes | yes | | | |
| Delete organization | yes | | | | |
| Invite, remove, change roles | yes | yes, up to admin | | | |
| View billing | yes | yes | yes | | |
| Manage billing | yes | | yes | | |

Every route and page checks the role on the server with
`requirePermission(headers, organizationId, permission)`. Nobody can invite or
promote someone above their own role, an organization always keeps an owner,
and invitations expire after 7 days, only work for the invited email (which
must be verified) and can be used once.

## Billing flows

- **Subscribe.** The server picks the amount, plan code, email and metadata,
  and initializes the transaction. The browser only gets the access code
  (inline popup) or the hosted checkout URL. Access is granted when the
  `charge.success` webhook or the callback page's `GET /transaction/verify`
  confirms the charge, whichever comes first, and only if the amount,
  currency and organization match what the server asked for.
- **Trial (card up front).** On plans with `trialDays`, the first checkout is a
  small card charge (NGN 50, GHS 0.10, ZAR 1, USD 0.20, KES 10). The card is
  saved, the charge is refunded, and a Paystack subscription is created that
  starts when the trial ends.
- **Upgrade.** Immediate and prorated. The difference for the rest of the
  period is charged to the saved card, a new Paystack subscription is created
  from the current period end, and only then is the old one disabled. If the
  card is declined, the customer pays the same amount through checkout.
- **Downgrade.** At the end of the period. The replacement subscription is
  created right away with a start date at period end, then the old one is
  disabled, so the old price cannot renew in between. Refused while the
  organization has more members than the smaller plan allows.
- **Cancel / resume.** Cancel disables renewal on Paystack; access continues
  until the period ends. Resume re-enables it before then.
- **Failed renewal.** `invoice.payment_failed` marks the subscription past due
  with a grace period, emails billing managers a Paystack link to update the
  card, and shows a banner. After the grace period access stops and the
  subscription is disabled.
- **Reconcile.** An hourly job retries failed webhooks, checks unpaid
  checkouts (failed payments send no webhook), resyncs subscriptions whose
  period ended without a renewal event, and applies scheduled downgrades.

Webhooks are verified with a constant-time HMAC-SHA512 check, stored once
(duplicates are acknowledged and ignored), answered with 200, then processed.
Processing is ordered per Paystack customer and derives state from the payload
and Paystack's API, so retries and out-of-order delivery end in the same state.

## What is in v1 and what is later

In this version:

- Email and password auth, organizations, invitations, five roles, org switcher
- React Email templates for auth and billing email, with trial-ending
  reminders
- Plan catalog and sync, subscribe, card-up-front trial, prorated upgrade,
  scheduled downgrade, cancel and resume, failed-payment grace period,
  reconcile cron, billing page with invoices
- Multi-currency catalog (NGN default; GHS, ZAR, KES and USD by config)
- 190+ tests, CI with a real Postgres service

Later:

- Magic link, email OTP, Google sign-in, two-factor auth, operator admin
- Card-retry schedule for failed renewals, PDF receipts
- Undoing a scheduled downgrade, organization soft delete
- Per-seat and usage-based pricing, coupons
- Playwright tests against Paystack test mode, a docs site
- Flutterwave and Stripe adapters behind the billing interface

## Deploying

The app has no Vercel-only parts. On Vercel, add the environment variables,
point `DATABASE_URL` at Neon or Supabase, and run `pnpm db:migrate` as part of
your release. Elsewhere (Railway, Fly, Docker), build with `pnpm build` and
run `pnpm --filter web start`, and call the reconcile route hourly from a
scheduler. Paystack needs a stable public URL for webhooks.

## Contributing

See `CONTRIBUTING.md`. Decisions behind the design are in `docs/decisions.md`.

## License

MIT

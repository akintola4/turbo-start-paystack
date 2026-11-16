# AGENTS.md

Instructions for coding agents (Claude Code, Codex, Cursor, Copilot, Gemini
CLI, Windsurf, Aider and the rest) working in Turbo Start Paystack. People
should read `README.md`. Task recipes are in [`docs/agents/`](docs/agents/README.md).

## What this is

A multi-tenant SaaS starter that bills through Paystack: a pnpm + Turborepo
monorepo with a Next.js 16 app, Better Auth organizations and roles, Drizzle
on Postgres, and webhook-driven Paystack subscriptions. Node 24+, pnpm 11.

The mental model:

- Organizations own everything. A user's power comes from their
  `member.role` in the organization being acted on: owner, admin, billing,
  member or viewer. There is no global admin. Permissions are checked on the
  server against the organization in the URL, never one from the body.
- Billing state has three writers: the webhook handlers
  (`packages/billing/src/webhook/`), the billing service
  (`packages/billing/src/service/`, including `confirmByReference`, which the
  checkout callback calls) and reconcile (`packages/billing/src/reconcile.ts`).
  Plan codes are written by `syncPlans` (`packages/billing/src/sync.ts`,
  behind `pnpm billing:sync`), and `pnpm payloads:redact` rewrites stored
  invoice payloads in place, only to seal secrets. Nothing else writes subscriptions, invoices, payment
  intents or plan codes.
- Money is integer subunits plus an ISO currency (`amountSubunit: 3_000_000`
  with `currency: "NGN"` is ₦30,000). Format it with `formatMoney`; never
  divide it.
- Webhooks are stored once, then processed. Handlers are idempotent and
  order-independent: they derive state from the payload and Paystack's API,
  so a retry or an out-of-order event ends in the same state.
- Secrets at rest are sealed. `email_token` and `authorization_code` are
  encrypted with `BILLING_ENCRYPTION_KEY`, in their columns and inside stored
  webhook payloads.

## First run

### Without Paystack keys (the mock, start here)

```bash
pnpm install
pnpm setup          # no prompts without a terminal; exits 1 with the fix if something is missing
pnpm dev            # app + Paystack mock in one process; runs until stopped
```

`pnpm setup` writes `apps/web/.env`, picks free ports (app from 3000, mock
from 4010), finds or starts Postgres, migrates, creates the plans on the mock
and seeds the demo org, Kola Logistics (slug `kola-logistics`, on the Free
plan). Sign in as `ada@kolalogistics.test` / `kola-demo-2026` (owner).
`tunde@` is billing, `chioma@` is member. The mock isn't left running, but it
keeps its plans, customers and subscriptions in `scripts/.paystack-mock.json`
(gitignored), so they're still there when `pnpm dev` starts it again.
`pnpm setup:reset` drops and reseeds the database and clears that file too.

Setup is safe to run again. It fills blanks in `apps/web/.env` and never
overwrites a value already there, except the ones an explicit option asks to
move: `SETUP_PORT` rewrites `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` and
`PAYSTACK_MOCK_WEBHOOK_URL`, `SETUP_MOCK_PORT` rewrites `PAYSTACK_API_URL`
and `PAYSTACK_MOCK_PORT`, and `SETUP_DB` rewrites `DATABASE_URL`. On the mock
it writes `PAYSTACK_SECRET_KEY=sk_test_local_mock`, an empty
`NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_API_URL=http://localhost:<mock
port>`, `PAYSTACK_MOCK_PORT` and `PAYSTACK_MOCK_WEBHOOK_URL`, plus generated
secrets. Moving that file to real test keys is a hand edit (see below).

Options for agents. `setup` is also a built-in pnpm command, and pnpm 10 and
11 drop or reject any flag written after `pnpm setup` (`pnpm setup --port=1`
fails with "Unknown option"), so use environment variables. Only `setup` has
this problem: other scripts take flags normally, for example
`pnpm billing:sync --currencies=NGN,USD`.

| Variable | Flag | Effect |
|---|---|---|
| `CI=1` or `SETUP_YES=1` | `--yes`, `-y` | Never prompt. Already the case with no TTY |
| `DATABASE_URL=postgres://user@127.0.0.1:port/<name>` | none | Use this Postgres when `apps/web/.env` has none. It must name the database (setup creates it if it's missing) and be on this machine |
| `SETUP_DB=<name>` | `--db=<name>` | Use this database name. It wins over the name in `DATABASE_URL` (and in `apps/web/.env`). Default `turbo_start_paystack` |
| `SETUP_PORT=<n>`, `SETUP_MOCK_PORT=<n>` | `--port=<n>`, `--mock-port=<n>` | Fixed app and mock ports (1024 to 65535, not equal) instead of the first free ones |
| `SETUP_ALLOW_REMOTE_DB=1` | none | Also accept a non-local `DATABASE_URL` from the environment, and let `--reset` drop a non-local database. Leave it off |
| none | `--reset` | What `pnpm setup:reset` passes: drop and reseed the database. Needs `pnpm dev` stopped |

Flags reach setup only through `pnpm run setup -- --yes --port=3600`, and
need the `=`: `--port 3600` is an error. A flag beats its variable. There is
no `--database-url`; use the variable. Without `DATABASE_URL`, setup scans
127.0.0.1:54329 to 54348 for a Postgres it can log in to as `postgres` (no
password, or `postgres`), or starts one on the first free port there with
`scripts/dev-db.sh` (Docker, or a local `initdb`/`pg_ctl`). It doesn't look at
port 5432. For a Postgres you already run there, pass `DATABASE_URL`.
When setup starts Postgres, it prints the command to stop it:
`docker stop tsp-postgres`, or `pg_ctl -D .pgdata stop` for a local
install. Data is kept either way.

`pnpm dev` doesn't return, so run it in the background. To stop it, find the
exact PIDs listening on the app and mock ports (`lsof -nP -iTCP:<port>
-sTCP:LISTEN -t`) and kill those. Never kill by name or pattern. The parent
`pnpm dev` exits by itself once both servers are gone, and its
`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL … Exit status 143` is expected (143 is
SIGTERM), not a failure.

The first `next dev` writes `apps/web/AGENTS.md`, Next.js's own generic
agent rules. It's gitignored. This file, at the repo root, is the one to
follow; where they differ, this one wins.

### Paystack test keys

```bash
cp .env.example apps/web/.env   # only if you have no apps/web/.env yet
# in apps/web/.env: PAYSTACK_SECRET_KEY=sk_test_…  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_…
pnpm setup          # sees a real key: leaves the mock off and PAYSTACK_API_URL unset
pnpm billing:sync   # creates the plans on your Paystack test account
pnpm dev
```

Already set up on the mock? Setup won't overwrite the mock's values, so edit
`apps/web/.env` by hand: set the two keys, and delete `PAYSTACK_API_URL`,
`PAYSTACK_MOCK_PORT` and `PAYSTACK_MOCK_WEBHOOK_URL`. While `PAYSTACK_API_URL`
points at localhost, setup and the app stay on the mock whatever the key is.

Paystack must be able to reach the app for webhooks. Run a tunnel
(`cloudflared tunnel --url http://localhost:3000`), set `BETTER_AUTH_URL` to
the tunnel URL, and set the test webhook URL in the dashboard to
`<tunnel>/api/webhooks/paystack`. The Simulate billing panel only appears on
the mock. Before trusting real behaviour, work through
`docs/paystack-verification.md`.

## Where things live

```txt
apps/web/src/app/                      routes: app/[orgSlug]/… pages, api/orgs/[orgId]/… handlers,
                                       api/webhooks/paystack, api/cron/billing-reconcile, billing/callback
apps/web/src/server/                   server-only: context.ts (wires every dependency), session.ts
                                       (requireOrgBySlug), views.ts (page loaders), billing-routes.ts and
                                       org-settings.ts (route handler bodies)
apps/web/src/proxy.ts                  per-request CSP nonce, /app sign-in redirect (authorizes nothing)
apps/web/test/, apps/web/e2e/          Vitest route and view tests, Playwright specs
packages/billing/src/catalog.ts        plans and prices: the only place amounts are defined
packages/billing/src/service/          checkout, plan change, cancel/resume, refunds (BillingService)
packages/billing/src/webhook/          verify.ts, ingest.ts (store once), process.ts, handlers.ts
packages/billing/src/reconcile.ts      retries events, expires checkouts, resyncs; run hourly by
                                       .github/workflows/billing-reconcile.yml, daily by the Vercel cron
packages/billing/src/fake-paystack.ts  fake Paystack: in memory in tests, saved to a file by the local mock
packages/billing/src/fixtures.ts       webhook payload builders from Paystack's documented examples
packages/billing/test/                 most of the tests; support.ts is the harness
packages/auth/src/roles.ts             roles, permission statements, canGrantRole
packages/auth/src/server.ts            Better Auth setup, requirePermission, getMembershipBySlug
packages/db/src/schema/                Drizzle schema (auth.ts, billing.ts); migrations in packages/db/drizzle
packages/email/src/templates/          React Email templates, registered in templates/index.ts
packages/env/src/server.ts             env validation; the app refuses to boot on a bad value
scripts/                               setup, dev, e2e, billing:sync, paystack:mock, webhook:replay
docs/decisions.md                      why things are the way they are
```

`packages/billing` never imports env or Next. Its dependencies (db, Paystack
client, logger, `notify`) are passed in by `apps/web/src/server/context.ts`.
Packages are source-only `@workspace/*` modules with no build step.

## Hard rules

1. **Never trust the client for billing data.** No route accepts a status,
   amount, plan code, subscription code, email token or customer code from
   the browser. The browser sends an organization id in the URL and a price
   id or action name. Everything else comes from the database or Paystack.
2. **Check permissions on the server, every time.** Route handlers call
   `authService.requirePermission(headers, organizationId, permission)` with
   the id from the URL. Pages call `requireOrgBySlug(slug)` and check
   `can(permission)`, then `notFound()` so another tenant's slug doesn't leak.
3. **Never divide money.** Store and compare integer subunits. Display goes
   through `formatMoney` (`packages/billing/src/money.ts`). Every new price
   must be at least the currency's Paystack minimum (below).
4. **Never log or return `email_token` or `authorization_code`.** Store them
   with `seal()` (`packages/billing/src/service/context.ts`). The logger
   (`packages/logger`) redacts known keys, but don't rely on it. Log error
   causes with `dbErrorCause()` (`packages/billing/src/webhook/process.ts`,
   internal to the billing package), never query parameters.
5. **Never insert billing rows by hand,** in code, seeds, tests or SQL.
   Tests drive real flows through the harness in
   `packages/billing/test/support.ts`: `h.subscribe()` for a paid
   subscription in one call, or `h.billing.startCheckout(...)`, then
   `const paid = h.pay(reference)`, which only builds the webhook payloads,
   then `await h.deliver(paid.charge)` (and `paid.created` when there is
   one). E2E drives the mock checkout and the
   Simulate billing panel.
6. **Webhook handlers are idempotent and order-independent.** Each new
   handler gets a test that delivers its events twice and in both orders.
7. **Never change a price in place.** `pnpm billing:sync` refuses: existing
   Paystack subscriptions keep their plan code. Add a new plan key instead.
8. **Schema changes go through Drizzle.** Edit `packages/db/src/schema/*`,
   run `pnpm db:generate`, commit the migration.
9. **`pnpm test` needs no network and no secrets.** Paystack is the fake
   behind msw. If real Paystack behaves differently, change the fake and the
   fixtures first so a test fails, then fix the code, then note it in
   `docs/paystack-verification.md`.

## How to verify

```bash
pnpm lint && pnpm check-types && pnpm test   # must pass
pnpm format:check                            # CI runs this too; pnpm format fixes it
```

- Timing, from a cold Turbo cache on a laptop: `pnpm test` about 1.5 to 2
  minutes, `pnpm check-types` about 20 seconds, `pnpm lint` a few seconds.
  Turbo caches each package's result, so a rerun only redoes the packages
  your change touched. Allow longer on a busy machine.
- `pnpm lint` passes with about 20 existing warnings, nearly all
  `noExcessiveCognitiveComplexity` (in `packages/billing`, `packages/auth`,
  `apps/web` and `scripts`). They're known and allowed: don't refactor them
  as part of another task, and don't add new ones. Warnings don't fail the
  run; errors do.
- `pnpm test` runs on PGlite with no setup. Under load the billing and auth
  suites can time out (`syncPlans … creates plans once` in
  `packages/billing/test/trial-reconcile-sync.test.ts` is the usual one).
  A timeout isn't a failure until it repeats when the package runs alone:
  `pnpm --filter @workspace/billing test` or `pnpm --filter @workspace/auth test`.
- The 3 real-Postgres tests (`packages/billing/test/*.pg.test.ts`:
  concurrency and invoice numbering) run only with
  `TEST_DATABASE_URL=postgres://…/postgres pnpm test`.
- `pnpm e2e` runs Playwright with the mock on 4210 and the app on 3200
  (`E2E_MOCK_PORT`, `E2E_PORT`). Its database is `E2E_DATABASE_URL`, or
  `DATABASE_URL` from `apps/web/.env` with `_e2e` added to the name. The
  name must end in `_e2e` and the host must be local. It's dropped and
  recreated at the start of every run and left in place afterwards, so you
  can inspect it. To remove it when you're done:
  `psql "<DATABASE_URL with the name replaced by postgres>" -c 'drop database "<name>_e2e" with (force)'`.
- Playwright needs Chromium once: `pnpm --filter web exec playwright install
  chromium`. `pnpm --filter web exec playwright install --list` shows what's
  installed. Browsers go to `~/Library/Caches/ms-playwright` on macOS and
  `~/.cache/ms-playwright` on Linux, outside the repo.
- `pnpm e2e e2e/landing.spec.ts` runs one spec. `e2e/landing.spec.ts`
  covers the landing page and its pricing; `e2e/setup.setup.ts` subscribes
  through the plan picker, so it runs at the start of every `pnpm e2e`.
- To drive a browser yourself (a screenshot, a flow no spec covers), prefer a
  short Node script with `@playwright/test`, or a spec run through
  `pnpm e2e`, over a browser MCP server. Those write their own files (for
  example `.playwright-mcp/`) wherever they run.
- The Simulate billing panel: with `pnpm dev` on the mock, sign in as Ada and
  open Billing (`/app/kola-logistics/settings/billing`). Start a trial and
  press "Pay with test card" on the mock checkout. The charge is a small
  card check (₦50), not the plan price; it's refunded, and the plan starts
  when the trial ends. Then open the dashed Simulate billing card at the
  bottom. It plays renewals, failed payments, recovery, trial end,
  duplicates and forged webhooks through the real webhook route.
- One webhook by hand: `pnpm webhook:replay scripts/fixtures/charge-success.json`,
  signed with `PAYSTACK_SECRET_KEY`. The fixtures hold placeholder
  references and codes (`tsp-replace-me` and so on): edit them to match rows
  in your database first, or the event is stored and matches nothing. Replay
  posts to `BETTER_AUTH_URL`'s webhook route only when that's local; pass
  `--url=` to send elsewhere (never with an `sk_live_` key).

## Done checklist

Don't call a task done until all of these hold:

- [ ] `pnpm lint && pnpm check-types && pnpm test` pass, and `pnpm format:check` is clean.
- [ ] Each behaviour change has a test. Billing changes are tested in
      `packages/billing/test`, routes and views in `apps/web/test`.
- [ ] New org-scoped routes and pages check a permission on the server, and
      a test shows a role without it gets 403 or 404.
- [ ] No billing value is read from the request body. No money is divided.
      No token is logged.
- [ ] Schema edits have a generated migration. Catalog edits went through
      `pnpm billing:sync` against the mock.
- [ ] UI or flow changes were tried in `pnpm dev` (and `pnpm e2e` when a
      spec covers them).
- [ ] Docs match: `README.md` for user-facing behaviour, `docs/decisions.md`
      for a new design call, `.env.example` for a new variable (with
      validation in `packages/env/src/server.ts`).
- [ ] Servers you started are stopped by PID. Nothing pushed unless asked.

## Paystack facts that surprise people

Checked in November 2026 against Paystack's docs, plus a few things seen in
production. `docs/paystack-verification.md` lists what still needs
confirming with a real test account:

- **A disabled subscription can't be re-enabled.** `/subscription/enable`
  refuses it, so "Resume" creates a new subscription on the saved card,
  starting at the current period end, and records the old code as replaced
  (`resumeSubscription` in `packages/billing/src/service/plan-change.ts`).
- **"Replace Card" on the manage page charges the new card** with
  `metadata.transaction_type: "update_card"`, and Paystack refunds it. In test
  mode the subscription never moves onto the new card. The handler re-reads
  the subscription's card from Paystack and leaves the event for reconcile
  to retry until it switches (`applyCardUpdateCharge` in
  `packages/billing/src/service/charge.ts`, `test/card-update.test.ts`).
- **Transaction minimums:** NGN ₦50, USD $2, GHS ₵0.10, ZAR R1, KES Ksh3.
  The trial card check uses these, with KES 10
  (`TOKENIZATION_AMOUNT` in `money.ts`).
- **`reference` allows only `-`, `.`, `=` and alphanumerics.** Ours is
  `tsp-` plus 32 hex digits.
- **Refunds go pending, then processing, then processed, failed or
  needs-attention.** `failed` means the amount went back to your balance and
  `needs-attention` needs the customer's bank details. Both email billing
  managers.
- **Webhooks are signed** with HMAC-SHA512 of the raw body using the secret
  key (`x-paystack-signature`). Live mode retries every 3 minutes for 4
  tries, then hourly for 72 hours. Test mode retries hourly for 10 hours,
  with a 30 second timeout on each request.
  Answer 200 quickly: the route stores the event and processes it after the
  response.
- **Cancelling doesn't end access.** The subscription goes `non-renewing`,
  `subscription.not_renew` arrives now and `subscription.disable` on the next
  payment date. A failed renewal leaves it in `attention`, and the starter
  doesn't count on Paystack retrying it (grace period instead).

Docs: [subscriptions](https://paystack.com/docs/payments/subscriptions/),
[webhooks](https://paystack.com/docs/payments/webhooks/),
[refunds](https://paystack.com/docs/payments/refunds/),
[API reference](https://paystack.com/docs/api/) (currencies, minimums,
`reference` rules).

## Recipes

One file per common job in [`docs/agents/`](docs/agents/README.md): add a
plan, add an org page or route, handle a new webhook event, add an email,
add a role or permission, deploy to Vercel + Neon, go live, debug a failed
webhook.

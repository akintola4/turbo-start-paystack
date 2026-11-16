# Contributing

Thanks for helping. Issues and pull requests are welcome.

## Setup

Follow "Getting started" in `README.md`. `pnpm paystack:mock` lets you run the
whole app without Paystack keys.

## Before opening a pull request

```bash
pnpm lint
pnpm format:check
pnpm check-types
pnpm test
```

If you have a local Postgres, also run the concurrency tests:

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres pnpm test
```

## Screenshots

Pull requests that change the UI should show it. Don't commit screenshots to
`main`: every copy of the starter would download them. Commit them to the
`screenshots` branch instead, and link them in the pull request by commit
(`https://github.com/akintola4/turbo-start-paystack/blob/<sha>/<path>?raw=true`)
so the links keep working. `docs/images/` is gitignored for this reason.
Images the README shows live in `docs/readme/`.

## Billing changes

- Add or update a test in `packages/billing/test` for every change in
  behaviour. Webhook handling must stay idempotent and must not depend on the
  order events arrive in; add a test that delivers the events in both orders.
- Never accept plan status, amounts, subscription codes or email tokens from
  the browser. Billing state is written by webhook handlers, server-side
  verification and the billing service only.
- If Paystack behaves differently from the fake in
  `packages/billing/src/fake-paystack.ts`, update the fake and the fixtures
  first, then the code, and note it in `docs/paystack-verification.md`.

## Schema changes

Edit `packages/db/src/schema/*`, then `pnpm db:generate` and commit the
migration.

## Commits

Small, logical commits with a plain message describing the change.

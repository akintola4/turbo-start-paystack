# CLAUDE.md

Guidance for AI assistants working in this repo.

## Shape

- pnpm + Turborepo monorepo. Packages are `@workspace/*`, source-only (no build
  step), and use `packages/typescript-config/library.json`.
- `packages/billing` holds the Paystack domain. It never imports env or Next;
  the web app builds its dependencies in `apps/web/src/server/context.ts`.
- `packages/auth` owns roles and `requirePermission`. Every org-scoped server
  action, route handler and page checks permissions there, using the
  organization id from the URL and the member row, never the request body.

## Rules

- Billing state is written only by webhook handlers, `confirmByReference`,
  the billing service and reconcile. No route accepts status, amounts,
  subscription codes or tokens from the client.
- Money is integer subunits plus an ISO currency. Never divide by 100 when
  storing.
- Webhook handlers must be idempotent and order-independent. Derive state from
  the payload and Paystack's API, not from which event came first.
- `email_token` and `authorization_code` are stored encrypted and never logged.
- Add a test for each behaviour change. `pnpm test` must pass without network
  access or secrets.

## Commands

```bash
pnpm lint && pnpm check-types && pnpm test
pnpm db:generate   # after editing packages/db/src/schema
```

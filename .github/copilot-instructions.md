# Copilot instructions

The full instructions for this repository are in [`AGENTS.md`](../AGENTS.md)
at the root: the mental model, first-run commands, how to verify and the
done checklist. Task recipes are in [`docs/agents/`](../docs/agents/README.md).
Read them before you change anything.

Apply these hard rules (copied from `AGENTS.md`) in every suggestion and
review:

1. **Never trust the client for billing data.** No route accepts a status,
   amount, plan code, subscription code, email token or customer code from
   the browser. The browser sends an organization id in the URL and a price
   id or action name. Everything else comes from the database or Paystack.
2. **Check permissions on the server, every time.** Route handlers call
   `authService.requirePermission(headers, organizationId, permission)` with
   the id from the URL. Pages call `requireOrgBySlug(slug)` and check
   `can(permission)`, then `notFound()`.
3. **Never divide money.** Amounts are integer subunits plus an ISO currency.
   Display goes through `formatMoney`.
4. **Never log or return `email_token` or `authorization_code`.** Store them
   with `seal()`.
5. **Never insert billing rows by hand,** in code, seeds, tests or SQL. Tests
   use the harness in `packages/billing/test/support.ts`.
6. **Webhook handlers are idempotent and order-independent,** with a test
   that delivers the events twice and in both orders.
7. **Never change a price in place.** Add a new plan key instead.
8. **Schema changes go through Drizzle:** edit `packages/db/src/schema/*`,
   run `pnpm db:generate`, commit the migration.
9. **`pnpm test` needs no network and no secrets.**

Before calling a change done: `pnpm lint && pnpm check-types && pnpm test`
and `pnpm format:check` pass, and each behaviour change has a test.

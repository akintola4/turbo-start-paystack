---
name: add-webhook-handler
description: Handle a new or changed Paystack webhook event in turbo-start-paystack (packages/billing/src/webhook/handlers.ts, fixtures, fake-paystack). Use when asked to "handle <event>", "support refund/dispute/transfer/subscription events", "react to a Paystack webhook", or when a webhook_event row shows an event nothing handles, or when a real payload differs from the fixtures.
---

# Handle a Paystack webhook event

Follow `docs/agents/add-webhook-handler.md`. This skill keeps the order of
work and the non-negotiables in view.

Order of work:

1. Read `docs/agents/add-webhook-handler.md`, then `dispatchEvent` in
   `packages/billing/src/webhook/handlers.ts` and one similar handler (for
   example `onRefund`).
2. Write the fixture builder in `packages/billing/src/fixtures.ts` from
   Paystack's documented example, keeping its field names and types.
3. Write the failing test in `packages/billing/test/` with the harness from
   `test/support.ts`. Reach the starting state through real flows
   (`h.createOrg`, `h.billing.startCheckout`, `h.pay`, `h.subscribe`). Never
   insert billing rows.
4. Add the `case` and the handler, then make the test pass.

Non-negotiables:

- Idempotent: delivering it twice, or a same-meaning copy with a different
  body, leaves the same rows and sends no second email (`notify` with a
  stable `key`).
- Order-independent: test both orders against any event it pairs with.
  Derive state from the payload or Paystack's API, not from arrival order.
- Return an `Outcome`. Use `{ error, retry: true }` only when the state it
  needs hasn't arrived yet, so reconcile retries it.
- Never log, audit or return `authorization_code` or `email_token`. Store
  them with `seal()`.
- If real Paystack behaviour differs from `fake-paystack.ts`, fix the fake
  and fixtures first, and add a line to `docs/paystack-verification.md`.

Finish with `pnpm --filter @workspace/billing test`, then
`pnpm lint && pnpm check-types && pnpm test`.

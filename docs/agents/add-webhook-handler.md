# Handle a new Paystack webhook event

How a webhook flows: `POST /api/webhooks/paystack` reaches
`handlePaystackWebhook` (`apps/web/src/server/billing-routes.ts`), which
calls `ingestWebhook` (`packages/billing/src/webhook/ingest.ts`). Ingest
verifies the HMAC-SHA512 signature, seals secrets in the payload and stores
the event once in `webhook_event`, keyed by the body's sha256. The route
answers 200, then `processEvent` (`webhook/process.ts`) runs
`dispatchEvent` (`webhook/handlers.ts`) in a transaction that holds a lock
per Paystack customer. Reconcile retries an event while `processed_at` is
null, up to 10 attempts.

Unknown events are stored and marked processed without doing anything. So
"handling" an event means adding a case to `dispatchEvent`.

## Files

- `packages/billing/src/webhook/handlers.ts`: the `case` and the handler
- `packages/billing/src/fixtures.ts`: a payload builder from Paystack's
  documented example
- `packages/billing/src/fake-paystack.ts`: only if the event needs API state
  the fake doesn't have yet (the handler re-reads Paystack, or a test needs
  the fake to emit it)
- `packages/billing/test/<event>.test.ts`: the tests
- Optional: a JSON fixture for `pnpm webhook:replay`, by adding the builder
  to `scripts/write-fixtures.ts` and running
  `pnpm --filter @workspace/scripts exec tsx write-fixtures.ts`
- `docs/paystack-verification.md`: an unchecked line for the payload shape
  you assumed

## Steps

1. Write the fixture first, from the payload on Paystack's docs page
   (https://paystack.com/docs/payments/webhooks/ links each event's
   example). Keep Paystack's field names and types. Amounts are integer
   subunits.
2. Add the case. Parse with a `z.looseObject` schema, so Paystack can add
   fields without breaking you, and return an `Outcome`:

   ```ts
   case "transfer.success": // an example: not handled today
     return onTransferSuccess(deps, tx, data);
   ```

   - `{}` means done. `{ error }` records the error and marks the event
     processed. `{ error, retry: true }` leaves `processed_at` null, so
     reconcile tries again. Use it when the state you need isn't there yet
     (for example, the matching `charge.success` hasn't arrived).
   - **Idempotent:** the same event processed twice gives the same rows.
     Prefer upserts on natural keys (`invoice_code`, `reference`,
     `subscription_code`) over inserts, and compare before you write.
   - **Order-independent:** don't assume another event came first. Derive
     state from the payload, and when it isn't enough, from Paystack's API
     (`deps.paystack.fetchSubscription(...)` and so on).
   - Look the organization up from our rows (`payment_intent`, `invoice`,
     `subscription` by code). Never from metadata alone.
   - Keep secrets sealed. Use `seal(deps, value)` for an
     `authorization_code` or `email_token` you store, and never put either
     in a log line or an `audit` row.
   - Record what happened with `audit(tx, { organizationId, action, target })`.
     To email people, call `deps.notify?.({ type, organizationId, key, ... })`
     with a `key` unique to the event, which deduplicates the email. Adding
     a type is covered in [add-email.md](add-email.md).
3. If the handler needs a Paystack endpoint the client doesn't have, add it
   to `packages/billing/src/paystack/client.ts` and teach the fake to answer
   it, then add a test in `test/paystack-client.test.ts`.

## Tests

Use the harness (`setupBilling` in `packages/billing/test/support.ts`).
`test/refund-webhooks.test.ts` is a compact model. Get to the state the
event applies to through real flows, not by inserting rows: `h.subscribe()`
gives an org with a paid subscription in one call. For a step-by-step path,
`h.createOrg()`, then `h.billing.startCheckout(...)`, then
`const paid = h.pay(reference)`. `h.pay` only builds the webhook payloads,
so follow it with `await h.deliver(paid.charge)` (and `paid.created` when
there is one). Then:

- `const event = await h.deliver(myEvent(...))` returns the stored
  `webhook_event` row. Assert `event.processedAt` is set and `event.error`
  is null, then check the rows, audit entries and `h.notifications`;
- deliver the identical body again: ingest dedupes it, so you get the same
  event id and nothing changes;
- deliver a copy whose body differs but means the same thing (another
  top-level `id`, a later timestamp), which skips the dedupe. It must
  leave the same rows, and send no second email;
- if it pairs with another event (say `charge.success`), deliver them in
  both orders and assert the same end state;
- a payload for an unknown customer or reference doesn't throw. It returns
  an outcome, and nothing for another org changes.

## Verify

```bash
pnpm --filter @workspace/billing test     # fast loop
pnpm lint && pnpm check-types && pnpm test
```

Against a running app on the mock, send it signed:

```bash
pnpm webhook:replay scripts/fixtures/<event>.json
```

The fixtures hold placeholder references and codes (`tsp-replace-me` and so
on). Edit them to match rows in your database first; otherwise the event is
stored but matches nothing. Then check `webhook_event` for the row
(`processed_at` set, `error` null).
If the event is one the Simulate billing panel can produce, add an action to
`SIMULATE_ACTIONS` in `packages/billing/src/simulate.ts` and `DEV_ACTIONS` in
`apps/web/src/server/dev-billing.ts`. That's optional.

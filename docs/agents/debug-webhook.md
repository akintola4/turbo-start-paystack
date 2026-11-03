# Debug a failed webhook

Every accepted webhook is a row in `webhook_event`. Start there, not in
Paystack's dashboard.

| Column | Meaning |
|---|---|
| `event_type` | `charge.success`, `invoice.update`, … |
| `received_at` | When ingest stored it |
| `processed_at` | Set when a handler finished (an error with no retry also counts). Null means it is still waiting for a retry |
| `attempts` | Processing attempts. Reconcile stops retrying at 10 (`MAX_EVENT_ATTEMPTS`) |
| `error` | The handler's `Outcome.error`, or the thrown message (first 1,000 characters) |
| `payload` | The body, with `authorization_code` and `email_token` sealed |

## 1. Did it arrive?

```sql
select id, event_type, received_at, processed_at, attempts, error
from webhook_event order by received_at desc limit 20;
```

No row means it never got past ingest. Check the route's response:

- **401 `bad_signature`:** the webhook was signed with a different secret
  key than `PAYSTACK_SECRET_KEY`. Usually that's a test/live mix-up, or a
  deployment whose env var changed without a redeploy.
- **401 `ip_not_allowed`:** `PAYSTACK_WEBHOOK_IP_ALLOWLIST=true`, and the
  client IP header isn't Paystack's. Check `CLIENT_IP_HEADER`.
- **413:** the body was over the size limit.
- **Nothing at all:** the dashboard's webhook URL is wrong for this mode, or
  points at a protected preview deployment. In test mode, Paystack retries
  hourly for 10 hours. In live mode, every 3 minutes for 4 tries, then
  hourly for 72 hours.

## 2. Did it process?

`processed_at` null and `error` set means the handler failed, or asked to
retry. Find the log line by event id:

- `webhook processing failed` (`packages/billing/src/webhook/process.ts`)
  means the transaction threw. The fields are `eventId`, `error`, and from
  `dbErrorCause()`, Postgres's `code`, `constraint` and `table` (never the
  parameter values). Typical codes:
  - `23505` unique violation: two writers raced, or a handler inserts where
    it should upsert;
  - `23503` foreign key: the row it points at (an organization, a price) is
    missing. Was `pnpm billing:sync` run for this database?
  - `40P01` deadlock: rare, because processing locks per customer. Retrying
    clears it.
- `webhook <event> handled with error` means the handler returned an
  `Outcome` with `error`. With `retry: true`, it's waiting for state that
  hasn't arrived yet, such as a renewal before its subscription, or a card
  update Paystack hasn't applied. Reconcile tries again.

## 3. Retry it

Reconcile retries unprocessed events under 10 attempts, oldest first, up to
50 per run (`processPending` in `packages/billing/src/webhook/process.ts`):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/billing-reconcile
# local: http://localhost:<port>/api/cron/billing-reconcile with CRON_SECRET from apps/web/.env
```

`eventsRetried` in the report counts the events that went through this
time. Fix the cause first (deploy the fix, sync the plans), then run it.
For an event that used up its 10 attempts, setting `attempts = 0` on that
one row lets reconcile pick it up again. That is the only manual write that
is acceptable here. Never edit `subscription`, `invoice` or
`payment_intent` rows to "fix" state. Reconcile and the next webhook derive
state from Paystack.

## 4. Reproduce it locally

1. Copy the payload's shape (not its sealed values) into a builder call in
   `packages/billing/src/fixtures.ts`, or start from `scripts/fixtures/*.json`.
2. Write a failing test in `packages/billing/test` with the harness
   (`h.deliver(payload)` returns the `webhook_event` row, so assert
   `processedAt` and `error`). If Paystack sent a shape the fake doesn't
   produce, change the fake and fixtures first, then the handler, and note
   it in `docs/paystack-verification.md`.
3. Against `pnpm dev` on the mock: `pnpm webhook:replay <file>.json` signs
   it with `PAYSTACK_SECRET_KEY` and posts it. Duplicates are stored once,
   so change a field such as `id` to replay a variant.

See [add-webhook-handler.md](add-webhook-handler.md) for the rules a fix has
to keep: idempotent, order-independent and no secrets in logs.

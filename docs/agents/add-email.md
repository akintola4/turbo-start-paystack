# Add a transactional email

Emails are React Email templates in `packages/email`. Each one renders an
HTML part and a plain-text part from the same `content()` description, and
goes to Resend's HTTP API (or, without `RESEND_API_KEY` in development, to
the log and the dev outbox in the Simulate billing panel's Emails tab).

## Files

- `packages/email/src/templates/<name>.tsx`: props type, `subject`,
  `content`, the component and its `PreviewProps`. Copy
  `refund-failed.tsx` (billing) or `reset-password.tsx` (auth)
- `packages/email/src/templates/index.ts`: register it in `templates` and
  export its props type
- `packages/email/emails/<name>.tsx`: a one-line default export for
  `pnpm email:preview`, like `emails/trial-ending.tsx`
- `packages/email/src/mailer.ts`: a typed method, such as `refundFailed`,
  that builds links with the mailer's helpers and calls `send(name, ...)`
- `packages/email/src/templates.test.ts` or `mailer.test.ts`: content tests

For an email that billing sends, also:

- `packages/billing/src/service/context.ts`: a new member of the
  `BillingNotification` union
- where the event happens (a webhook handler, the service, reconcile):
  `deps.notify?.({ type, organizationId, key, ... })`
- `apps/web/src/server/billing-emails.ts`: a `case` in `sendOne` that calls
  your mailer method
- `apps/web/test/billing-emails.test.ts`: the mapping

## Steps

1. Write the template. The subject goes through `oneLine(...)`. Money is
   `amountSubunit` plus `currency`, formatted with `formatMoney` from
   `../format`. Dates are `Date`s, formatted with `formatDate`. Every link
   must be absolute `https:` (or `mailto:`). Take URLs as props, built by
   the mailer, and never build them from user input.
2. Register it in `templates/index.ts`. Previews, the render test and
   `pnpm --filter @workspace/email export` all iterate over `templates`, so
   that one entry makes them pick it up.
3. Add the mailer method. The recipient's `key` becomes the Resend
   idempotency key, so a retried webhook doesn't send twice. For billing
   emails it is the notification's `key`, so make that stable per event
   (for example `refund-failed:<reference>`).
4. Billing emails only: add the notification type, emit it after the state
   change, and map it in `billing-emails.ts`. Notifications are sent after
   the transaction commits (`transactionWithNotifications`), to every member
   whose role has `billing:manage`.
5. Never put `email_token`, `authorization_code` or a full card number in
   an email. Last four digits and brand are fine.

## Tests

- `templates.test.ts` already renders every registered template with its
  `PreviewProps` and checks the subject, HTML, text and https-only links.
  Add a `content` test for what this email has to say (amount, date, link)
  in both the HTML and the text.
- For billing emails, a test in `packages/billing/test` that the event sends
  exactly one notification with the expected `key`
  (`h.notifications.filter(n => n.type === "...")`), even when delivered
  twice. Then a mapping test in `apps/web/test/billing-emails.test.ts`.

## Verify

```bash
pnpm --filter @workspace/email test
pnpm email:preview                       # http://localhost:3001, light and dark
pnpm lint && pnpm check-types && pnpm test
```

In `pnpm dev`, trigger the email and open Simulate billing, then Emails, to
see the rendered message. `pnpm --filter @workspace/email send-test --to <your inbox> --only <name> --inline`
sends it through Resend for a real-client check (it needs `RESEND_API_KEY`).

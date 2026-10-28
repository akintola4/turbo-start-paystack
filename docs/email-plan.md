# Email templates plan

Replaces the plain-text emails with React Email templates (HTML plus a
plain-text alternative). The transport stays as it is: `fetch` to Resend's
HTTP API, the dev outbox and log without a key, and a hard failure in
production without a key unless `EMAIL_TRANSPORT=log`.

## Packages

`react-email` 6 is now the package that ships the components and the preview
CLI; `@react-email/components` is deprecated on npm. Components are imported
from `react-email` and `render` from `@react-email/render`; the preview UI is
`@react-email/ui` (dev only). All three are in the pnpm catalog.

## File layout

```txt
packages/email/
  emails/                 preview entry points for `email dev` (sample props)
  src/
    index.ts              public API: createEmailSender, createMailer, types
    transport.ts          Resend fetch transport, dev outbox, Idempotency-Key
    mailer.ts             createMailer: render template -> { subject, html, text } -> send
    render.ts             renderEmail(element) -> { html, text }
    theme.ts              EmailTheme (product name, logo URL, colours, support URL),
                          passed to components as a prop (no React context: the
                          package is bundled into Next.js server code)
    links.ts              appLink() / checked external links (no user-supplied URLs)
    format.ts             formatMoney (integer subunits + currency), formatDate (UTC)
    components/           Layout, Button, Heading, Text, DetailTable
    templates/*.tsx       one file per email
  scripts/export.tsx      renders every template's sample props to .html/.txt
```

## Templates

| Template | Props | Triggered from |
|---|---|---|
| `verify-email` | name, url (Better Auth, must be on the app origin) | `emailVerification.sendVerificationEmail` in `packages/auth` |
| `reset-password` | name, url (same check) | `sendResetPassword` in `packages/auth` |
| `organization-invitation` | inviterName, inviterEmail, organizationName, role, invitationId (link built from the app URL), expiresInDays = 7 | org plugin `sendInvitationEmail` |
| `payment-receipt` | organizationName, planName, interval, amountSubunit, currency, reference, paidAt, periodStart/End, billingUrl | `charge.success` for a first checkout or a renewal (`charge.ts`) |
| `payment-failed` | organizationName, planName, graceUntil, manageUrl (Paystack link, host-checked, falls back to billing page) | `invoice.payment_failed` -> past_due (`handlers.ts`) |
| `trial-ending` | organizationName, planName, interval, trialEndsAt, amountSubunit, currency, billingUrl | reconcile job, 3 days before `trial_ends_at` |
| `subscription-canceled` | organizationName, planName, accessUntil, resumeUrl | `cancel` in the billing service and `subscription.not_renew` (only on the transition to non_renewing) |
| `plan-changed` | organizationName, fromPlan, toPlan, kind (upgrade/downgrade), chargedSubunit, currency, effectiveAt, billingUrl | `changePlan` (upgrade charged or scheduled downgrade) and the upgrade checkout fallback's `charge.success` |
| `trial-started`, `card-expiring`, `payment-disputed` | small notices that already existed as plain text | existing notifications |

Each template exports its component, a `subject(props)` function and sample
`PreviewProps` (used by the preview, the tests and the export script). All
user-provided strings (names, org names) are rendered as
React text, so they are escaped. Links are never taken from user input: app
links are built from the configured app URL, Better Auth URLs must share its
origin, and Paystack manage links must be https on a Paystack host (or the
configured Paystack API origin for the local mock); otherwise the billing page
link is used.

## Wiring

- `packages/auth` takes a `mailer` (the auth subset of `createMailer`) instead
  of a raw `sendEmail`.
- `packages/billing` keeps `notify(notification)`; the notification union
  gains `payment_succeeded`, `subscription_canceled`, `plan_changed`,
  `trial_ending`, and each notification carries a `key` for idempotency.
  Notifications raised inside a database transaction are queued and sent only
  after the transaction commits, so a rolled-back webhook does not email.
- `apps/web/src/server/billing-emails.ts` maps a notification to a template:
  it looks up the organization name and slug, resolves plan names from the
  catalog and emails every member with `billing:manage`.
- Resend `Idempotency-Key` = sha256 of `key + recipient` (Resend keeps keys
  for 24 hours), so a retried webhook or a verify/webhook race does not send
  twice.

## Trial-ending reminders

`subscription.trial_reminder_sent_at` (new nullable column, drizzle-kit
migration). Reconcile selects `trialing` subscriptions whose `trial_ends_at`
is within 3 days and whose reminder column is null, sets the column with a
conditional update (so two concurrent runs can't both claim it) and sends
after commit. At most once: if the send fails after the claim, the reminder is
lost rather than repeated.

## Preview and tests

- `pnpm email:preview` (root) = `pnpm --filter @workspace/email dev` runs
  `email dev --dir emails` on port 3001 with sample props for every template.
- Vitest in `packages/email`: every template renders HTML and text with its key
  strings, money formatting for NGN/GHS/ZAR/KES/USD, UTC dates, link checks,
  transport sends `html` + `text` + `Idempotency-Key`, dev outbox fallback,
  production throws without a key.
- Billing tests assert the new notifications; web test covers the
  notification -> email mapping; auth tests read links from rendered mail.
- `pnpm --filter @workspace/email export <dir>` writes every template to HTML for screenshot
  checks (light/dark, 600px/375px) with Playwright.

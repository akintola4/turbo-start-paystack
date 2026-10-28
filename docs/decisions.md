# Decisions

Decisions behind turbo-start-paystack. "Approved" means the project owner chose
it from the research plan (`PLAN.md` §10). "Builder's call" means the plan left
it open or recommended an option and the builder took it; each says why, so it
can be revisited.

## Approved

1. **Auth: Better Auth with the organization plugin.** Users, organizations,
   members and invitations live in our Postgres, so billing joins are plain
   SQL and there is no auth vendor bill.
2. **ORM: Drizzle (Postgres).** Pinned at `^0.45.4` (>= 0.45.2 for
   CVE-2026-39356).
3. **Upgrades are prorated.** The difference for the rest of the period is
   charged with `POST /transaction/charge_authorization`.
4. **Trials: card up front.** A small refundable charge saves the card; the
   Paystack subscription starts when the trial ends.
5. **Pricing: flat per-organization plans in v1.** No per-seat billing.
6. **Home: `akintola4/turbo-start-paystack`**, private until the owner makes
   it public.

## Builder's calls

### From PLAN.md §10

7. **Billing engine: Paystack Subscriptions plus `charge_authorization`
   (plan §6.0, option A).** Paystack schedules renewals and sends its own
   invoices; `charge_authorization` is used only for proration charges. The
   engine sits behind `createBillingService`, so a self-scheduled engine can
   be added later.
8. **Docs app deferred to v1.1.** v1 ships `README.md` and `docs/*.md`.
9. **No demo resource.** PLAN §10.7 offered a demo "projects" board but did not
   recommend it, so the dashboard is a placeholder that shows the
   server-computed entitlement. The `project:*` permissions from §9 are not
   shipped; add them with the resource.
10. **`better-auth-paystack`: spiked, not adopted; we own `packages/billing`.**
    Time-boxed read of the published source (v3.5.6, `dist/index.mjs`, about
    3,900 lines) on 2026-10-28. Findings:
    - The webhook signature is compared with `!==`, not a constant-time
      comparison (PLAN §2.3 #13 is exactly this).
    - Prorated upgrades only work for "locally managed" subscriptions. For
      subscriptions on Paystack plans it throws "Paystack-managed
      subscriptions do not support … Use local billing". Our approved model
      is Paystack Subscriptions with prorated upgrades, which it cannot do.
    - `peerDependencies` pins `better-auth` to exactly `1.7.7`; the current
      release is 1.7.14.
    - It depends at runtime on a community SDK (`@alexasomba/paystack-node`).
    - A webhook that arrives while the same event is being processed throws,
      which returns a non-200 and relies on Paystack retrying.
    - Single maintainer, 18 stars.
    Ideas we kept from it: hashing the raw body as the dedupe key, the
    Paystack IP list, and the tokenisation-charge trial.

### Billing behaviour

11. **Downgrades create the replacement at schedule time.** PLAN §6.4 says to
    disable the old subscription and create the new one at period end from a
    cron/webhook. If that job ran late, Paystack would renew the old price
    first. Instead, the replacement is created immediately with
    `start_date = current_period_end`, then the old one is disabled. Local
    state swaps at period end (renewal charge, `subscription.disable`, or
    reconcile). Undoing a scheduled downgrade is not in v1.
12. **Order of a plan change: create new, then disable old.** If the create
    fails, the proration charge is refunded and nothing on Paystack changes;
    the failure is committed to the audit log before the error is returned.
    If the disable fails, the old code is recorded in `replaced_subscription`
    and reconcile retries it. Webhooks for replaced codes are ignored.
13. **Prices are never changed in place.** `billing:sync` refuses if a price id's
    amount differs from what it synced. Add a new price id instead; existing
    subscribers keep their plan code.
14. **Billing currency is locked per organization** at its first checkout.
    Plan changes must stay in that currency.
15. **Paystack customers are per email, not per organization.** Two
    organizations billed to the same email share a customer code. Renewals
    (which carry customer and plan, not our metadata) are matched on both,
    then each match is re-derived from `GET /subscription/:code`.
16. **Webhook processing is serialised per Paystack customer** with a
    transaction-scoped Postgres advisory lock. Found during the end-to-end
    smoke: `charge.success` and `subscription.create` arrive back to back and
    were processed concurrently, so the second could not see the row the first
    was creating. A real-Postgres test covers it.
17. **Webhooks are processed after the 200.** The route stores the event
    (unique on the sha256 of the raw body) and answers 200, then processes it
    in `after()`. Handler failures are written to the event row; reconcile
    retries them, up to 10 attempts.
18. **Proration rules.** Charges below the currency's tokenisation minimum are
    waived. Monthly↔annual changes scale the new price to the current period
    using 30 and 365 days. Upgrades during a trial charge nothing. Only
    `active` and `trialing` subscriptions can change plan: past-due must update
    the card first, non-renewing must resume first.
19. **Grace and leeway.** Past-due keeps access for `BILLING_GRACE_DAYS`
    (default 7), then reconcile disables it. Active and trialing subscriptions
    get 24 hours after their period end for the renewal to land. A trial only
    becomes active when a charge is seen or Paystack moves the billing date.
20. **`BILLING_TRIAL_MODE=card|off`** (PLAN §6.3 `TRIAL_MODE`). The no-card
    trial (T2) is not implemented.
21. **No retry schedule for failed renewals.** PLAN §6.7 marks it optional.
    Dunning is the grace period, a banner and an email with Paystack's
    manage link. Card retries with `charge_authorization` are a later feature.

### Auth and access

22. **Admins can view billing but not manage it** (PLAN §9: "configurable").
    The `billing` role manages it. Change `roles.admin` in
    `packages/auth/src/roles.ts` to give admins `billing: ["manage"]`.
23. **Invitation tokens are Better Auth invitation ids, not hashed.** PLAN
    §2.3 #4 asks for hashed tokens. The organization plugin stores the id in
    clear and hashing it would mean forking the plugin. Mitigations in place:
    the invite only works for the invited email, that email must be verified
    (`requireEmailVerificationOnInvitation`), it expires after 7 days, it is
    single-use, and invitation ids are hidden from members who cannot invite
    (list endpoint returns 403, full-organization payload strips them).
24. **Role caps.** A before-hook stops anyone granting or changing a role
    ranked above their own (owner 4, admin 3, billing 2, member 2, viewer 1).
    Better Auth's own rules already keep a last owner and stop non-owners
    granting owner.
25. **Plan member limits are enforced on invite and on accept** through the
    org plugin's `membershipLimit` and a `beforeCreateInvitation` check
    (members plus pending, unexpired invitations).
26. **Billing mutations are JSON route handlers, not server actions**
    (`/api/orgs/[orgId]/billing/[action]`). Each one checks the permission in
    the target organization, parses the body strictly (unknown keys are a
    400), and requires `application/json` as defence in depth against CSRF on
    top of Better Auth's SameSite cookies. They are easy to test and to call
    from the smoke script.
27. **Deleting an organization cancels its subscription first**
    (`beforeDeleteOrganization`). The 30-day soft delete from PLAN §6.5 is not
    in v1.
28. **Auth methods in v1: email and password only.** Magic link, OTP, Google,
    two-factor and the operator admin plugin are listed as later work.

### Tooling

29. **Tests: PGlite plus a fake Paystack behind msw.** Concurrency tests need
    real Postgres and run when `TEST_DATABASE_URL` is set; CI provides a
    Postgres 17 service.
30. **Email: React Email templates over Resend's HTTP API**, no SDK. Every
    email is a template in `packages/email/src/templates` rendered to HTML
    plus a plain-text part (`render(…, { plainText: true })`); both go to
    `POST /emails` with `fetch`. When the caller has a natural key (payment
    reference, subscription plus date) the request carries an
    `Idempotency-Key` (sha256 of key and recipient; Resend remembers keys for
    24 hours), so a retried webhook or a verify/webhook race does not send
    twice. Without a key, mail is logged in development; in production that
    fallback throws unless `EMAIL_TRANSPORT=log` is set on purpose (for
    running a production build locally). Plan: `docs/email-plan.md`.
    - **Packages:** `react-email` 6 for the components and the `email dev`
      preview (with `@react-email/ui`), `@react-email/render` for rendering.
      `@react-email/components` is deprecated on npm; v6 moved the components
      into `react-email`.
    - **Styling: inline styles from one theme object, not the `<Tailwind>`
      component.** The theme (`packages/email/src/theme.ts`: product name,
      logo URL, support link, light and dark colours) is the single place to
      rebrand, and it is set from env (`EMAIL_BRAND_NAME`, `EMAIL_LOGO_URL`,
      `EMAIL_SUPPORT_URL`). Inline styles survive clients that strip
      `<style>` (some Gmail views), need no Tailwind config or render-time CSS
      processing, and keep the emails' look independent of the app's
      Tailwind setup. A small `<style>` block adds only what inline styles
      cannot do: dark-mode colours for clients that honour
      `prefers-color-scheme` (Apple Mail, iOS, Outlook.com via
      `[data-ogsc]`) and a narrower card on phones. Gmail and Outlook for
      Windows apply their own inversion to the light design.
    - **The theme is a prop, not React context.** The email package is
      imported by server code that Next.js bundles for route handlers and
      server components, where `createContext` is not allowed.
    - **Links are never taken from user input.** App links are built from
      `BETTER_AUTH_URL` with each path segment encoded; Better Auth's
      verification and reset URLs must be on that origin or the send throws;
      Paystack manage-card links must be https on a Paystack domain (or the
      local mock's origin), otherwise the billing page is linked instead.
      Names are rendered as React text, so they are escaped, and line breaks
      are stripped from subjects.
    - **Billing emails are sent after the database commit.**
      `transactionWithNotifications` queues `notify` calls made inside a
      transaction and delivers them after it commits, so a rolled-back
      webhook or plan change never emails and a slow send never holds row
      locks. A failed send is logged, not retried: the billing state is
      already correct, and the event key keeps a later resend idempotent.
    - **Who gets billing email:** members whose role has `billing:manage`.
    - **Trial-ending reminder: 3 days before, at most once.** Reconcile claims
      the reminder by setting `subscription.trial_reminder_sent_at` with a
      conditional update, then sends after commit. If that send fails the
      reminder is lost rather than repeated. The amount is the price that
      will be charged (a downgrade scheduled during the trial wins).
    - **Cancellation email** is sent when our cancel runs, or when Paystack's
      `subscription.not_renew`/`disable` moves an active or trialing
      subscription to non-renewing (cancelled from Paystack's side). Our own
      cancel already set non-renewing, so its webhook does not email again.
    - **Receipts** go out for the first checkout charge and for renewals. A
      prorated upgrade sends the plan-change email (with the amount) instead
      of a separate receipt. Paystack also emails its own receipt to the card
      holder.
31. **Packages are source-only** like turbo-start-sanity, but use a
    `library.json` tsconfig with `moduleResolution: Bundler` so relative
    imports don't need `.js` extensions.
32. **pnpm 11.24.0, Biome 2.5.15, Turbo 2.11**, matching turbo-start-sanity.

# turbo-start-paystack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An open-source, multi-tenant SaaS starter (Turborepo + pnpm) with Better Auth organizations, org-scoped roles and Paystack subscription billing that is driven only by verified, idempotent webhooks and server-side verification.

**Architecture:** `apps/web` (Next.js 16) is a thin shell. Domain logic lives in source-only workspace packages: `@workspace/db` (Drizzle schema + migrations), `@workspace/auth` (Better Auth + organization plugin + access control + `requirePermission`), `@workspace/billing` (Paystack client, catalog, proration, webhook verify/ingest/process, billing service, reconcile). Packages take their dependencies (db, Paystack client, clock, email) as arguments, so every flow is tested in Vitest against PGlite with the Paystack HTTP API mocked by msw.

**Tech Stack:** pnpm 11 catalogs, Turborepo 2, Biome 2, TypeScript 5.9, Next.js 16.4, React 19, Better Auth 1.7 (organization plugin), Drizzle ORM 0.45.x (>= 0.45.2) + drizzle-kit, postgres-js, PGlite (tests), Vitest, msw, t3-env, Tailwind 4 + shadcn (new-york).

**Spec:** `../turbo-start-paystack-plan/PLAN.md` (research plan, outside the repo) plus the approved decisions recorded in `docs/decisions.md`.

## Global Constraints

- Package names `@workspace/*`; source-only `exports` (no build step); every package has `lint`, `format`, `format:check`, `check-types`, and `test` where it has tests.
- Dependency versions shared by more than one package go in the pnpm `catalog:`.
- Node >= 24. `packageManager: pnpm@11.24.0`.
- Money is always integer subunits (`bigint` in Postgres, `number` in TS, safe below 2^53) plus an ISO-4217 `currency` (`char(3)`). Never divide by 100 in storage.
- Every tenant-owned row has `organization_id`. Billing belongs to the organization, never the user.
- Only webhook handlers, server-side verification and the billing service write subscription/invoice state. No route accepts plan status, amount, subscription code or email token from the client.
- Webhook signature: hex HMAC-SHA512 of the raw body keyed with `PAYSTACK_SECRET_KEY`, compared with `crypto.timingSafeEqual` on equal-length buffers. Bad or missing signature returns 401.
- Webhook persistence happens before processing; duplicates return 200; handler errors are recorded on the event row and never produce a 5xx.
- Paystack allow-list IPs: `52.31.139.75`, `52.49.173.169`, `52.214.14.220` (env-toggled).
- Tokenisation (card-up-front trial) amounts in subunits: NGN 5000, GHS 10, ZAR 100, USD 20, KES 1000 (KES unconfirmed, see verification checklist).
- Invitations expire after 7 days, are bound to the invited email and are single-use. A member cannot invite or assign a role above their own rank.
- `email_token` and `authorization_code` are stored AES-256-GCM encrypted with `BILLING_ENCRYPTION_KEY`, and never logged.
- No secrets, `.env` values, dumps or cookie jars from the research clones. `.env.example` holds placeholders only.
- Commit messages and PR bodies carry no trailers of any kind.

## Review Focus

1. **Webhook arrives twice or out of order** (`subscription.create` before `charge.success`, `subscription.disable` before `subscription.not_renew`): final state must be the same as in-order delivery. Tests in Task 9.
2. **Amount/currency mismatch on `charge.success` or verify** (e.g. a tampered or wrong-plan reference): must not activate. Test in Task 9.
3. **Disable webhook for the *old* subscription after a plan change**: must not cancel the org. Test in Task 11.
4. **Downgrade below current member count**: must be refused with a clear error. Test in Task 11.
5. **`past_due` beyond grace**: entitlement must turn off even if no further webhook ever arrives. Test in Tasks 7 and 12.

---

## File structure

```txt
package.json, pnpm-workspace.yaml, turbo.json, biome.jsonc, tsconfig.json, .npmrc, .gitignore
.github/workflows/ci.yml, .github/PULL_REQUEST_TEMPLATE.md, .github/renovate.json
README.md, CLAUDE.md, LICENSE, CONTRIBUTING.md, SECURITY.md, .env.example (root, documents all names)
docs/{implementation-plan.md, decisions.md, paystack-verification.md, paystack-setup.md, CONTEXT.md}
packages/typescript-config   base.json, nextjs.json, react-library.json
packages/tailwind-config     postcss.config.mjs, src/utils.ts (cn)
packages/env                 src/server.ts, src/client.ts
packages/logger              src/index.ts (Logger with redaction)
packages/ui                  shadcn components (button, input, label, card, badge, table, select, alert), globals.css
packages/db                  src/schema/{auth.ts,billing.ts,index.ts}, src/client.ts, src/testing.ts, drizzle/ (migrations), drizzle.config.ts
packages/auth                src/{access.ts, roles.ts, server.ts, permissions.ts, client.ts}, test/
packages/email               src/{index.ts, templates.ts}
packages/billing             src/{money.ts, catalog.ts, crypto.ts, proration.ts, entitlements.ts,
                             paystack/{client.ts,types.ts}, webhook/{verify.ts,ingest.ts,process.ts,handlers.ts},
                             service.ts, reconcile.ts, sync.ts, errors.ts, index.ts}, test/{fixtures/, msw.ts, *.test.ts}
apps/web                     src/app/** (pages + route handlers), src/server/{context.ts, billing-routes.ts}, src/lib/auth-client.ts, proxy.ts
scripts/                     paystack-mock.ts (local fake Paystack API), webhook-replay.ts, dev-db.sh
```

---

## Milestone M0: scaffold

### Task 1: Monorepo root and config packages

**Files:** Create root files listed above, `packages/{typescript-config,tailwind-config,env,logger}`.

**Interfaces:**
- Produces: `@workspace/logger` → `class Logger { constructor(context: string); info/warn/error(message: string, data?: Record<string, unknown>) }`, plus `redact(value: unknown): unknown` which replaces values of keys matching `/token|authorization_code|secret|password|signature/i` with `"[redacted]"`.
- Produces: `@workspace/env/server` → `env` with `DATABASE_URL`, `BETTER_AUTH_SECRET` (min 32), `BETTER_AUTH_URL`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_API_URL` (default `https://api.paystack.co`), `PAYSTACK_WEBHOOK_IP_ALLOWLIST` (bool, default false), `BILLING_ENCRYPTION_KEY` (64 hex chars), `BILLING_GRACE_DAYS` (default 7), `BILLING_CURRENCY` (enum NGN|GHS|ZAR|KES|USD, default NGN), `CRON_SECRET`, `EMAIL_FROM`, `RESEND_API_KEY` (optional). `@workspace/env/client` → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `NEXT_PUBLIC_APP_URL`. Both honour `SKIP_ENV_VALIDATION`.

- [ ] Step 1: Write `packages/logger/src/index.test.ts`: `redact({ email_token: "x", nested: { authorization_code: "y" }, ok: 1 })` equals `{ email_token: "[redacted]", nested: { authorization_code: "[redacted]" }, ok: 1 }`.
- [ ] Step 2: Run `pnpm --filter @workspace/logger test` → FAIL (module missing).
- [ ] Step 3: Implement logger + root config (turbo `transit` task, Biome config copied in spirit from turbo-start-sanity, catalog).
- [ ] Step 4: `pnpm install && pnpm lint && pnpm check-types && pnpm test` → all pass.
- [ ] Step 5: Commit `chore: scaffold monorepo with config, env and logger packages`.

### Task 2: UI package and web app shell

**Files:** `packages/ui/**`, `apps/web/{package.json,next.config.ts,tsconfig.json,postcss.config.mjs,src/app/{layout.tsx,page.tsx,globals.css}}`, `.github/workflows/ci.yml`.

- [ ] Step 1: Add shadcn new-york components (button, input, label, card, badge, table, select, alert) to `packages/ui` with `cn` from `@workspace/tailwind-config/utils`.
- [ ] Step 2: Minimal marketing page in `apps/web` that renders `Button` from `@workspace/ui/components/button`.
- [ ] Step 3: `pnpm build` → Next build succeeds. CI workflow runs install, lint, format:check, check-types, test, build (build with `SKIP_ENV_VALIDATION=1`).
- [ ] Step 4: Commit `feat: add ui package and web app shell`. Create private GitHub repo and push (M0 green).

## Milestone M1: database, auth, organizations, roles

### Task 3: Database schema and test harness

**Files:** `packages/db/src/schema/{auth.ts,billing.ts,index.ts}`, `src/client.ts`, `src/testing.ts`, `drizzle.config.ts`, `drizzle/*` (generated), `test/schema.test.ts`.

**Interfaces:**
- Produces: `type Database` (Drizzle `PgDatabase` over `typeof schema`), `createDb(url: string): Database` (postgres-js), `createTestDb(): Promise<{ db: Database; close(): Promise<void> }>` (PGlite + migrations applied).
- Produces tables: Better Auth (`user`, `session` with `activeOrganizationId`, `account`, `verification`, `organization`, `member`, `invitation`) and billing (`billing_customer`, `plan_price`, `subscription`, `invoice`, `payment_intent`, `webhook_event`, `audit_log`) with the columns in PLAN.md §5. Enums: `subscription_status` = `incomplete|trialing|active|past_due|non_renewing|canceled|expired`; `invoice_status` = `pending|paid|failed|void`; `payment_intent_kind` = `subscribe|trial|upgrade|proration`; `payment_intent_status` = `created|succeeded|failed|abandoned`. Extra subscription columns: `grace_until`, `scheduled_plan_price_id`, `scheduled_subscription_code`. Partial unique index `subscription_one_live_per_org` on `organization_id` where status not in (`canceled`,`expired`). `webhook_event.dedupe_key` unique.

- [ ] Step 1: Tests: inserting two live subscriptions for one org throws a unique violation; a second `webhook_event` with the same `dedupe_key` throws; a `canceled` + an `active` subscription for one org is allowed.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Write schema, `drizzle-kit generate`, `createTestDb` applies `drizzle/` with `drizzle-orm/pglite/migrator`.
- [ ] Step 4: Run → PASS. Commit `feat(db): add auth and billing schema with PGlite test harness`.

### Task 4: Access control and Better Auth server

**Files:** `packages/auth/src/{access.ts,roles.ts,server.ts,permissions.ts,client.ts}`, `test/{helpers.ts,invitations.test.ts,permissions.test.ts}`.

**Interfaces:**
- Produces: `statements` (`organization: [update, delete]`, `member: [create, update, delete]`, `invitation: [create, cancel]`, `billing: [view, manage]`, `project: [create, read, update, delete]`), roles `owner|admin|billing|member|viewer` per PLAN.md §9, `ROLE_RANK = { owner: 4, admin: 3, billing: 2, member: 2, viewer: 1 }`.
- Produces: `createAuth(opts: { db: Database; secret: string; baseURL: string; sendEmail: (msg: EmailMessage) => Promise<void>; memberLimit?: (orgId: string) => Promise<number> }): Auth`.
- Produces: `requirePermission(auth: Auth, headers: Headers, organizationId: string, permission: Permission): Promise<{ userId: string; email: string; role: Role }>` throwing `AuthError` with `status` 401 (no session) or 403 (not a member / lacks permission). `type Permission = \`${resource}:${action}\``.
- Config: email+password, `requireEmailVerificationOnInvitation: true`, `invitationExpiresIn: 7 days`, before-hooks that cap invite role and role updates at the caller's rank and restrict listing invitations to `invitation:create` holders. Organization + owner member created in one transaction (plugin behaviour, asserted in test).

- [ ] Step 1: Tests (real Better Auth on PGlite via `auth.api.*` with session cookies):
  - `member` cannot invite (403) — closes §2.3 #3.
  - `admin` inviting `owner` is refused; `admin` inviting `admin` succeeds — closes #3 (escalation).
  - accepting an invitation as a different email fails; expired invitation fails; accepting twice fails — closes #4.
  - a `member` cannot list invitations of their org; a user from another org cannot read members or invitations of an org they don't belong to — closes #5.
  - `requirePermission` returns 401 without session, 403 for non-member, 403 for `member` asking `billing:manage`, passes for `billing` role — closes #15 (org-scoped, no global role).
  - `admin` cannot change a member's role to `owner`; last owner cannot be removed.
- [ ] Step 2: Run → FAIL. Step 3: implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(auth): better auth with org roles, invite caps and requirePermission`.

### Task 5: Email package and web auth/org UI

**Files:** `packages/email/src/{index.ts,templates.ts}`, `apps/web/src/app/{api/auth/[...all]/route.ts, (auth)/sign-in, (auth)/sign-up, app/page.tsx, app/[orgSlug]/{layout.tsx,page.tsx,members/page.tsx}, accept-invite/[id]/page.tsx}`, `apps/web/src/server/context.ts`, `apps/web/proxy.ts`.

**Interfaces:**
- Produces: `createEmailSender({ from, resendApiKey? }): (msg: EmailMessage) => Promise<void>`; without a key it logs a redacted line and appends to an in-memory/dev outbox (`getDevOutbox()`), used by the smoke test.
- Produces (web): `getServerContext()` → `{ db, auth, billing }` singletons from env; `requireOrgBySlug(slug, permission?)` used by every `/app/[orgSlug]` layout/page.

- [ ] Step 1: Sign-up/sign-in pages, org list + create form, members page (list, invite with role select, change role, remove) using the Better Auth client; layout 404s for non-members.
- [ ] Step 2: `pnpm check-types && pnpm build` → pass. Commit `feat(web): auth pages, org switcher and members management`.

## Milestone M2: billing

### Task 6: Money, catalog, crypto, Paystack client

**Files:** `packages/billing/src/{money.ts,catalog.ts,crypto.ts,errors.ts,paystack/{client.ts,types.ts}}`, `test/{msw.ts,money.test.ts,catalog.test.ts,crypto.test.ts,paystack-client.test.ts}`.

**Interfaces:**
- `CURRENCIES = ["NGN","GHS","ZAR","KES","USD"] as const`; `formatMoney(amountSubunit: number, currency: Currency): string`; `TOKENIZATION_AMOUNT: Record<Currency, number>`.
- `catalog: PlanDefinition[]` with `{ key: "free"|"starter"|"pro"; name; limits: { members: number }; trialDays: number; prices: { interval: "monthly"|"annually"; currency: Currency; amountSubunit: number }[] }`; `planPriceId(planKey, interval, currency): string` (e.g. `pro-monthly-ngn`); `getPlanPrice(id)`; `getPlanLimits(planKey)`. Free plan has no prices and `members: 3`.
- `encryptSecret(plain: string, keyHex: string): string`, `decryptSecret(cipher: string, keyHex: string): string` (AES-256-GCM, `v1:iv:tag:data` base64).
- `createPaystackClient({ secretKey, baseUrl, fetch? })` → methods `createCustomer`, `initializeTransaction`, `verifyTransaction`, `chargeAuthorization`, `refund`, `createSubscription`, `fetchSubscription`, `disableSubscription`, `enableSubscription`, `getManageLink`, `createPlan`, `updatePlan`, `listPlans`. Responses Zod-parsed with `.passthrough()`. Retries 429/5xx up to 3 times with backoff (honours `retry-after`). Throws `PaystackError { status, message }` when `status: false`.

- [ ] Step 1: Tests: `formatMoney(500000, "NGN")` contains `5,000.00`; catalog prices are positive integers and ids unique; crypto round-trips and rejects a tampered tag; client sends `Authorization: Bearer sk_test_x`, retries once on 500 then succeeds, throws `PaystackError` on `{status:false}`.
- [ ] Step 2: FAIL → implement → PASS. Commit `feat(billing): money, catalog, secret encryption and typed paystack client`.

### Task 7: Proration and entitlements (pure)

**Files:** `src/{proration.ts,entitlements.ts}`, `test/{proration.test.ts,entitlements.test.ts}`.

**Interfaces:**
- `computeProration({ oldAmount, newAmount, periodStart: Date, periodEnd: Date, now: Date }): { remainingFraction: number; credit: number; charge: number }`, integers via `Math.round`, `charge = max(0, round(newAmount*f) - round(oldAmount*f))`.
- `getEntitlement(sub: SubscriptionRow | null, now: Date): { active: boolean; planKey: PlanKey; reason: string; limits }` — active when status in (`trialing`,`active`,`non_renewing`) and `now < currentPeriodEnd` (trialing uses `trialEndsAt`), or `past_due` and `now < graceUntil`. Otherwise falls back to `free`.

- [ ] Tests: half-period upgrade NGN 500000 → 1500000 charges 500000; `now >= periodEnd` charges 0; canceled sub → free; `non_renewing` before end → active, after end → free; `past_due` within grace → active, after grace → free (Review Focus 5); `active` with `currentPeriodEnd` 1 day past → free (closes §2.3 #7 "cancelled/expired still passes").
- [ ] FAIL → implement → PASS. Commit `feat(billing): proration maths and entitlement rules`.

### Task 8: Webhook verify and ingest

**Files:** `src/webhook/{verify.ts,ingest.ts}`, `test/{fixtures/*.json, fixtures.ts, webhook-verify.test.ts, webhook-ingest.test.ts}`.

**Interfaces:**
- `verifyPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean`.
- `isPaystackIp(ip: string | null): boolean`.
- `ingestWebhook({ db, rawBody, signature, secretKey, ip?, enforceIpAllowlist? }): Promise<{ status: 200 | 401 | 400; eventId?: string; duplicate?: boolean }>`; dedupe key = `sha256(rawBody)`; insert with `onConflictDoNothing`.
- Test helper `signFixture(payload, secret): { body, signature }`.

- [ ] Tests: valid signature accepted; one flipped hex char rejected; different-length signature rejected without throwing; missing header → 401 and nothing stored; same body twice → second `duplicate: true` and one row; non-JSON body with valid signature → 400; IP allow-list on → foreign IP 401.
- [ ] FAIL → implement → PASS. Commit `feat(billing): webhook signature verification and idempotent ingest`.

### Task 9: Billing service: checkout, verify, webhook processing

**Files:** `src/service.ts`, `src/webhook/{process.ts,handlers.ts}`, `test/{service-checkout.test.ts, webhook-process.test.ts}`.

**Interfaces:**
- `createBillingService(deps: { db; paystack; encryptionKey; callbackUrl; graceDays; now?: () => Date; logger? })` returning:
  - `startCheckout({ organizationId, actor: { userId, email }, planPriceId }): Promise<{ reference; accessCode; authorizationUrl; kind: "subscribe" | "trial" }>` — server price, server metadata `{ organization_id, payment_intent_id, kind }`, `channels: ["card"]`, refuses if a live paid sub exists (use changePlan) or currency differs from the org's locked currency.
  - `confirmByReference(reference): Promise<SubscriptionRow | null>` — `GET /transaction/verify`, then the same `applyChargeSuccess`.
  - `processEvent(eventId): Promise<void>` and `processPending(limit)`; marks `processed_at` or `error`, increments `attempts`.
  - `getSubscription(orgId)`, `listInvoices(orgId)`.
- Handlers: `charge.success` (intent by reference → validate amount/currency/metadata org; or renewal by `plan.plan_code` + customer code), `subscription.create`, `invoice.create` (pending only), `invoice.update`, `invoice.payment_failed`, `subscription.not_renew`, `subscription.disable`, `subscription.expiring_cards`, `refund.processed`, `charge.dispute.*` (audit only). Each runs in a transaction that locks the org's subscription row (`FOR UPDATE`).

- [ ] Tests (msw for Paystack, PGlite):
  - startCheckout sends server amount and plan code; metadata from server; client-provided amount impossible (signature has no amount) — closes #6.
  - `charge.success` then `subscription.create` → `active`, code + encrypted token stored; reverse order → identical state (Review Focus 1).
  - duplicate `charge.success` → one invoice, one subscription — closes #9.
  - `charge.success` with amount ≠ intent amount, or metadata org ≠ intent org → not activated, event error recorded (Review Focus 2).
  - `invoice.create` alone → invoice `pending`, subscription unchanged — closes #8.
  - `invoice.payment_failed` → `past_due`, `grace_until = now + graceDays`.
  - `subscription.not_renew` → `non_renewing`, `cancel_at_period_end`; then `subscription.disable` before period end → still `non_renewing`; after period end → `canceled`. Disable before not_renew gives same result.
  - confirmByReference activates without any webhook; then the webhook is a no-op.
  - handler throwing marks `error` and does not throw out of `processEvent` — closes #13 (no 5xx loop).
- [ ] FAIL → implement → PASS. Commit `feat(billing): checkout, server-side verify and state-based webhook handlers`.

### Task 10: Webhook + billing routes in web, org-scoped and permission-checked

**Files:** `apps/web/src/app/api/webhooks/paystack/route.ts`, `apps/web/src/app/api/orgs/[orgId]/billing/[action]/route.ts`, `apps/web/src/server/billing-routes.ts`, `apps/web/src/app/app/[orgSlug]/settings/billing/{page.tsx,checkout-button.tsx}`, `apps/web/src/app/billing/callback/page.tsx`, `apps/web/test/billing-routes.test.ts`.

**Interfaces:**
- `handleBillingAction({ auth, billing, headers, organizationId, action, body }): Promise<Response>` where `action` ∈ `checkout|change-plan|cancel|resume|manage-card|status`; `status` needs `billing:view`, the rest `billing:manage`; body is Zod-parsed and only `planPriceId` is accepted.
- Webhook route: `ingestWebhook` → 401/400/200, then `after(() => billing.processEvent(eventId))`.

- [ ] Tests: unauthenticated → 401 — closes "unauthenticated billing endpoints"; `member` role → 403 on checkout (role-denied case); `billing` role → 200; user of org A calling with org B's id → 403 — closes #14 (org-scoped); body containing `status`/`amount`/`subscriptionCode` is ignored/rejected — closes #1, #2, #11.
- [ ] Billing page renders entitlement computed on the server; the `/app/[orgSlug]` layout gates paid features server-side — closes #7.
- [ ] FAIL → implement → PASS → `pnpm build`. Commit `feat(web): paystack webhook route and permission-checked billing routes`.

### Task 11: Plan changes, cancel, resume, manage card

**Files:** `src/service.ts` (extend), `test/service-plan-change.test.ts`.

**Interfaces:**
- `changePlan({ organizationId, actor, planPriceId, memberCount }): Promise<{ kind: "upgraded" | "checkout_required" | "downgrade_scheduled"; checkout? }>`.
  - Upgrade (higher amount, same currency): proration charge via `charge_authorization` (reference = new intent, kind `proration`); on success create new Paystack subscription (`start_date = current_period_end`, stored authorization) **then** disable old; if creating the new one fails, refund the proration and leave the old untouched. If charge fails or is `paused`, return `checkout_required` with an `upgrade` intent whose `charge.success` completes the same finalisation.
  - Downgrade: refuse if `memberCount > newPlan.limits.members` (Review Focus 4); create new subscription with `start_date = current_period_end`, then disable old; store `scheduled_plan_price_id`/`scheduled_subscription_code`; swap at period end.
- `cancel({ organizationId, actor })` → `disableSubscription(code, token)` from DB values, local `non_renewing`; `resume(...)` → `enableSubscription`, local `active`; `getManageCardLink(orgId)` → `manage/link` URL.

- [ ] Tests: upgrade calls charge_authorization with computed amount, then POST /subscription, then disable — asserted call order (closes #10); old sub's `subscription.disable` webhook afterwards leaves the org `active` on the new plan (Review Focus 3); create-subscription failure → refund called, old plan kept; charge failure → `checkout_required`; downgrade over member limit → `BillingError("over_member_limit")`; cancel uses DB token and never the request body; resume flips back to active.
- [ ] FAIL → implement → PASS. Commit `feat(billing): prorated upgrade, scheduled downgrade, cancel and resume`.

### Task 12: Reconcile job, card-up-front trial, plan sync

**Files:** `src/{reconcile.ts,sync.ts}`, `apps/web/src/app/api/cron/billing-reconcile/route.ts`, `scripts/billing-sync.ts`, `test/{reconcile.test.ts,trial.test.ts,sync.test.ts}`.

**Interfaces:**
- `reconcile(deps): Promise<{ retried; abandoned; resynced; downgradesApplied; expired }>`: retries unprocessed/errored events (attempts < 10); verifies `created` intents older than 1h (`abandoned` if not success, applied if success); resyncs subscriptions whose period ended via `GET /subscription/:code`; applies scheduled downgrades whose period ended; `past_due` past grace → `canceled` + remote disable.
- Trial: `startCheckout` on a plan with `trialDays > 0` for an org that never had a subscription initialises a `trial` intent of `TOKENIZATION_AMOUNT[currency]` without `plan`; on its `charge.success`: refund, `POST /subscription { customer, plan, authorization, start_date: now + trialDays }`, local `trialing` with `trial_ends_at`. First renewal `charge.success` → `active`.
- `syncPlans({ db, paystack, catalog, mode })`: creates missing Paystack plans, never mutates amounts of existing ones (creates a new plan instead), writes codes to `plan_price`.
- Cron route requires `Authorization: Bearer ${CRON_SECRET}`.

- [ ] Tests: abandoned intent marked; errored event retried to success; past-due past grace → canceled + disable called; trial refund + subscription create with start date; sync idempotent (second run creates nothing); cron route 401 without secret.
- [ ] FAIL → implement → PASS. Commit `feat(billing): reconcile job, card-up-front trial and plan sync`.

### Task 13: Dev tooling, docs, smoke

**Files:** `scripts/{paystack-mock.ts,webhook-replay.ts,dev-db.sh}`, `docs/{decisions.md,paystack-verification.md,paystack-setup.md}`, `README.md`, `.env.example`.

- [ ] `paystack-mock.ts`: local HTTP server implementing the endpoints the client uses (for booting the app without keys). `webhook-replay.ts <fixture> --reference=...`: signs and posts a fixture.
- [ ] Docs per the brief. README: setup, env names, Paystack dashboard setup, roles, flows, v1 vs later.
- [ ] Smoke: boot web against local Postgres + mock: sign up → verify email → create org → invite → accept → checkout (mock) → replayed `charge.success` + `subscription.create` → billing status `active`; `member` checkout → 403.
- [ ] Commit `docs: readme, decisions and paystack verification checklist`.

M3/M4 items not covered above (React Email templates, dunning retries via charge_authorization, invoice PDFs, Playwright e2e in test mode, docs site) are listed in README "Later".

---

## Execution notes (added after the build)

Tasks 1–13 were implemented in order. Where the build departed from the plan
above, the reason is in `docs/decisions.md`; the main ones:

- The billing service was split into focused modules under
  `packages/billing/src/service/` (checkout, charge, switch-plan, plan-change,
  sync-remote, invoices) rather than one `service.ts`.
- `billing_customer.paystack_customer_code` is not unique (one Paystack
  customer per email can pay for several organizations); renewals are matched
  on customer + plan and re-derived from `GET /subscription/:code`.
- Added `replaced_subscription.email_token`/`disabled_at` so a failed disable
  during a plan change is retried by reconcile.
- Added `BILLING_TRIAL_MODE=card|off` and `EMAIL_TRANSPORT=log`.
- The end-to-end smoke on real Postgres found a race between `charge.success`
  and `subscription.create`; processing is now serialised per Paystack
  customer with an advisory lock, covered by a `TEST_DATABASE_URL` test and a
  Postgres service in CI.
- Not done from Task 5: an org switcher based on the shadcn sidebar and the
  dnd-kit data table (a plain select and table are used instead).
- Email templates (React Email, receipts, plan-change, cancellation and
  trial-ending emails) were added afterwards; plan in `docs/email-plan.md`,
  decisions in `docs/decisions.md` #30.

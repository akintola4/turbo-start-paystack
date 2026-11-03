---
name: add-org-page
description: Add an organization-scoped page under /app/[orgSlug] or an API route under /api/orgs/[orgId] in turbo-start-paystack, with a server-side permission check (requirePermission, requireOrgBySlug + can). Use when asked to "add a page", "add a settings tab", "add an endpoint/route/action for an org", "let admins/billing do X", or when writing a new route.ts or page.tsx under apps/web/src/app/app/[orgSlug] or apps/web/src/app/api/orgs.
---

# Add an org-scoped page or route

Follow `docs/agents/add-org-page.md`. These are the checks reviewers reject
a change for.

Before you write code, read `docs/agents/add-org-page.md`, then one model of
each kind: `apps/web/src/server/org-settings.ts` (handler) and `loadBilling`
in `apps/web/src/server/views.ts` (page loader).

Rules:

- The organization comes from the URL (`orgSlug` for pages, `orgId` for
  routes). Never take it from the body, a cookie or the session.
- Route handlers call
  `deps.authService.requirePermission(headers, organizationId, "<resource>:<action>")`
  before anything else, and map `AuthError` to 401 or 403.
- Page loaders call `requireOrgBySlug(slug)`, then
  `if (!can("<permission>")) notFound()`. A 404, not a 403, so other
  tenants' slugs don't leak.
- Bodies go through `z.strictObject`, with nothing org-shaped: no ids,
  roles, amounts, statuses or plan codes. Billing changes go through
  `deps.billing.*`, never direct writes to billing tables.
- Every query filters on the organization id. Mutations get
  `userRateLimit(deps.db, actor.userId, "orgMutation")`.
- If you need a new permission, add it first
  (`docs/agents/add-role-or-permission.md`).

Tests (model: `apps/web/test/settings-routes.test.ts`): signed out gets 401,
another org's member gets 403, a role without the permission gets 403 or 404
with nothing changed, the allowed role succeeds, and an extra body field
gets 400.

Finish with `pnpm lint && pnpm check-types && pnpm test`. Then open the page
in `pnpm dev` as `ada@kolalogistics.test` (owner) and
`chioma@kolalogistics.test` (member), both with the password
`kola-demo-2026`.

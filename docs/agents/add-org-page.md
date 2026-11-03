# Add an org-scoped page or route

Everything under an organization is checked on the server, using the
organization in the URL and the caller's `member` row. Never use an id from
the request body or a role from the session. The `/app/[orgSlug]` layout
only proves membership, and `src/proxy.ts` only redirects signed-out
visitors. Neither checks a permission, so every page and handler does its
own.

Permissions are `resource:action` strings from `packages/auth/src/roles.ts`,
for example `billing:view`, `billing:manage`, `organization:update`,
`member:create` or `invitation:create`. To add one, see
[add-role-or-permission.md](add-role-or-permission.md).

## A page: `/app/[orgSlug]/<name>`

Files:

- `apps/web/src/app/app/[orgSlug]/<name>/page.tsx` (and `loading.tsx` if it's slow)
- A loader in `apps/web/src/server/views.ts` (or a new `server/<name>.ts`
  with `import "server-only"`), plus its view-model type in
  `apps/web/src/lib/view-models.ts`
- The component in `apps/web/src/components/<name>/`
- Navigation: `loadShell` in `views.ts` builds the sidebar links. Gate the
  link on the same permission as the page

Steps:

1. Write the loader. It resolves the org from the slug, checks the
   permission and 404s, because a 403 would confirm the slug exists:

   ```ts
   export async function loadReports(orgSlug: string): Promise<ReportsData> {
     const { organization, can } = await requireOrgBySlug(orgSlug); // 404 if not a member
     if (!can("billing:view")) {
       notFound();
     }
     const { db } = getServerContext();
     // every query filters on organization.id
   }
   ```

   `loadBilling` and `loadBillingDenied` in `views.ts` are the models. For a
   friendlier page than a 404, follow `loadBillingDenied`.
2. The page only awaits `params` and renders, as
   `apps/web/src/app/app/[orgSlug]/members/page.tsx` does.
3. Return plain data (strings, numbers, ISO dates) to the client component.
   Money is preformatted with `formatMoney` on the server.

## A route handler: `/api/orgs/[orgId]/<name>`

Files:

- `apps/web/src/app/api/orgs/[orgId]/<name>/route.ts`: a thin wrapper
- `apps/web/src/server/<name>.ts`: the handler, a plain function of `(deps, input)`
- `apps/web/test/<name>.test.ts`

Steps:

1. Copy the shape of `apps/web/src/server/org-settings.ts`
   (`handleOrgSettings`):
   - check the content type, then call
     `deps.authService.requirePermission(input.headers, input.organizationId, "<permission>")`
     and turn an `AuthError` into its status (401 or 403);
   - rate-limit mutations with `userRateLimit(deps.db, actor.userId, "orgMutation")`;
   - parse the body with `z.strictObject`. Nothing org-shaped goes in it:
     no organization ids, roles, amounts, statuses or plan codes;
   - scope every query by `input.organizationId`.
2. The route file reads `params`, `await headers()` and the JSON body, and
   passes them with `getServerContext()`. See
   `apps/web/src/app/api/orgs/[orgId]/settings/[action]/route.ts`.
3. Billing actions don't write billing tables. They call the billing service
   (`deps.billing.*`), as `apps/web/src/server/billing-routes.ts` does.

Responses under `/api` get the deny-all API CSP from `next.config.ts`, and
the proxy doesn't run for them. Neither needs a change.

## Tests

Model them on `apps/web/test/settings-routes.test.ts`: `createTestDb()`
from `@workspace/db/testing`, `createAuth(...)`, real sign-ups and sign-ins,
then the handler called with each user's cookie headers. Cover:

- signed out: 401;
- a member of another org, using this org's id: 403;
- a role without the permission (a `viewer`, say): 403, with nothing changed;
- a role with it: 200, and the change shows up in the database;
- an extra body field, such as `organizationId`: 400 (strict schema).

For pages, add the loader's rules to an existing view test or to an e2e spec
(`apps/web/e2e/`, signed in with `STATE.ada` or `STATE.chioma` from
`e2e/users.ts`).

## Verify

```bash
pnpm lint && pnpm check-types && pnpm test
pnpm e2e e2e/<spec>.spec.ts   # if you added a spec
```

In `pnpm dev`, open the page as Ada (owner), then as Chioma (member). The
role without the permission should get a 404 or the denied view, never the
data.

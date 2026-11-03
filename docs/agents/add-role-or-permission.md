# Add a role or a permission

Roles belong to a membership in one organization (`member.role`, a text
column, so no migration is needed). They're defined once with Better Auth's
access control in `packages/auth/src/roles.ts`, and the same definitions
power the organization plugin, `requirePermission` and the UI's `can(...)`.

## Files

- `packages/auth/src/roles.ts`: `statements` (resources and actions),
  `roles`, `ROLE_RANK`, and `canGrantRole` if the new role has special
  grant rules
- `apps/web/src/lib/format.ts`: `ROLE_META` (label and one-line description)
- `apps/web/src/lib/view-models.ts`: the `Role` union
- `apps/web/src/server/views.ts`: where the UI reads `can("...")` for the
  new permission
- `apps/web/src/components/landing/features/demos.tsx`: the landing demo
  lists the roles by hand
- `packages/auth/test/permissions.test.ts`, `apps/web/test/roles-and-seats.test.ts`
- `packages/auth/test/billing-role.test.ts`: asserts the exact
  `canGrantRole`/`grantableRoles` lists, so a new role changes them
- `README.md`: the Roles table

## A new permission

1. Add the action to `statements`, for example
   `reports: ["view", "export"]`. The `Permission` type
   (`"reports:view"` and so on) follows automatically.
2. Grant it in `roles`. Every role is listed explicitly, and a role without
   the action doesn't have it.
3. Check it on the server wherever it matters: `requirePermission(headers,
   organizationId, "reports:export")` in handlers, and `can("reports:view")`
   in loaders (see [add-org-page.md](add-org-page.md)). Hiding a button
   isn't a check.

## A new role

1. Add it to `roles` with its statements, and to `ROLE_RANK`. Rank caps
   invitations and role changes: nobody grants a role ranked above their
   own. Peers share a rank (`billing` and `member` are both 2).
2. If the role can spend money (`billing:manage`), `canGrantRole` already
   restricts it to granters who have `billing:manage` themselves. Keep it
   that way.
3. Add it to `ROLE_META` and the `Role` union so the members page can show
   and assign it.
4. Owners stay special: only owners grant `owner`, and an organization
   always keeps at least one. Don't weaken those rules in
   `packages/auth/src/server.ts`.

## Tests

- `packages/auth/test/permissions.test.ts`: `roleHasPermission` for every
  role against the new permission (a table test is clearest), and
  `requirePermission` returning 403 for a role without it.
- `canGrantRole` and `grantableRoles` for the new role, including who can't
  grant it.
- Each route or page that uses the permission gets a test that a role
  without it gets 403 or 404.

## Verify

```bash
pnpm --filter @workspace/auth test
pnpm lint && pnpm check-types && pnpm test
```

In `pnpm dev`, invite a member with the new role from Members (as Ada), sign
in as them (the invite email is in Simulate billing, then Emails) and check
what they can and can't open.

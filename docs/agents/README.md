# Agent recipes

Short, task-shaped guides for coding agents (people can use them too). Read
[`AGENTS.md`](../../AGENTS.md) first, for the mental model, first-run
commands and hard rules. Each recipe lists the files to touch, the steps,
the tests to add and how to verify.

| Job | Recipe |
|---|---|
| Add or change a plan or price | [add-plan.md](add-plan.md) |
| Add an org-scoped page or API route with a permission check | [add-org-page.md](add-org-page.md) |
| Handle a new Paystack webhook event | [add-webhook-handler.md](add-webhook-handler.md) |
| Add a transactional email | [add-email.md](add-email.md) |
| Add a role or a permission | [add-role-or-permission.md](add-role-or-permission.md) |
| Deploy to Vercel and Neon | [deploy-vercel.md](deploy-vercel.md) |
| Go live: test keys to live keys | [go-live.md](go-live.md) |
| Debug a failed webhook | [debug-webhook.md](debug-webhook.md) |

Every recipe ends with the same gate, which CI also runs:

```bash
pnpm lint && pnpm check-types && pnpm test && pnpm format:check
```

Background reading: `docs/decisions.md` (why things are built the way they
are), `docs/paystack-setup.md` (dashboard setup) and
`docs/paystack-verification.md` (what to confirm against real test mode).

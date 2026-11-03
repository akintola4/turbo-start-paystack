# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Project skills live in `.claude/skills/`: `add-plan`, `add-webhook-handler`,
  `add-org-page` and `deploy-vercel`. Each one points at its recipe in
  `docs/agents/`. Use the matching skill before you start one of those jobs.
- Run `pnpm dev` and `pnpm e2e --serve` with `run_in_background`, and stop
  them by the exact PIDs listening on their ports, never by name.
- After editing `packages/db/src/schema`, run `pnpm db:generate` and commit
  the migration it writes.

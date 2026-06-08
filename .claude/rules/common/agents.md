# Agent Orchestration

## Available agents (plugin-provided)

These agents come from the **ECC plugin** and are invoked by their `ecc:`-prefixed
`subagent_type` (e.g. `ecc:code-reviewer`), or via the matching `/ecc:*` slash
command. They are **not** in `~/.claude/agents/` — that directory is empty, so the
bare names will not resolve. Use the `ecc:` form.

| Agent (`subagent_type`) | Slash command | Purpose | When to use |
|---|---|---|---|
| `ecc:planner` | `/ecc:plan` | Implementation planning | Complex features, refactoring |
| `ecc:architect` | — | System design | Architectural decisions |
| `ecc:tdd-guide` | — | Test-driven development | New behavioral logic |
| `ecc:code-reviewer` | `/ecc:code-review` | Code review | After writing code |
| `ecc:security-reviewer` | `/ecc:security-scan` | Security analysis | Auth/input/secrets/endpoints |
| `ecc:build-error-resolver` | `/ecc:build-fix` | Fix build errors | When a build/typecheck fails |
| `ecc:e2e-runner` | — | E2E testing | Critical user flows |
| `ecc:refactor-cleaner` | `/ecc:refactor-clean` | Dead-code cleanup | Code maintenance |
| `ecc:doc-updater` | `/ecc:update-docs` | Documentation | Updating docs |

> **This repo:** the git root *is* this repo (no parent monorepo), so Agent
> worktree isolation fails — **dispatch builder sub-agents in-place**, not in
> per-teammate worktrees (the worktree-per-teammate flow in AGENTS.md does not
> apply here). See CLAUDE.md.

## What is actually enforced vs. advisory

Be honest about the gates — the config must not imply automation that isn't there:

- **Enforced in code** (`.claude/settings.json` hooks): a **PostToolUse typecheck**
  after every `.ts`/`.tsx` edit, and a **Stop hook** that type-checks the
  storefront + backend and blocks finishing on real type errors. `medusa develop`
  / `next dev` are transpile-only (no type-check), so this hook is the real
  "builds green" gate — it is the *only* automatic quality gate.
- **Advisory / operator-invoked** (NOT auto-enforced): everything below. No hook
  forces a review, TDD, or security pass to run — you must invoke them. They are
  strong recommendations, not guarantees, so don't assume they ran.

## Recommended agent usage (advisory)

Invoke when the task warrants it — recommendations, not automatic triggers:

1. Complex feature / refactor → `ecc:planner` (or `/ecc:plan`) before building.
2. After writing substantive code → `ecc:code-reviewer` (or `/ecc:code-review`).
3. New behavioral logic (utilities, hooks, backend) → `ecc:tdd-guide`.
   Presentational/visual work is covered by the Playwright capture/compare loop
   instead — see web/testing.md.
4. Architectural decision → `ecc:architect`.
5. Security-sensitive change (auth, user input, secrets, endpoints, payments) →
   `ecc:security-reviewer` (or `/ecc:security-scan`).

## Parallel Task execution

Use parallel Task execution for genuinely independent operations:

```markdown
# GOOD: independent work fanned out in one message
1. Security analysis of auth module
2. Performance review of cache system
3. Type checking of utilities

# BAD: sequential when there is no dependency
First agent 1, then agent 2, then agent 3
```

Don't force parallelism onto a dependency chain (e.g. migrate → probe → verify is
sequential); fan out only the steps that are actually independent.

## Multi-perspective analysis

For complex problems, use split-role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker

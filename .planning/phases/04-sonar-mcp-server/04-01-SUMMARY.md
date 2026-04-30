---
phase: 04
plan: 01
subsystem: mcp
tags: [scaffold, deps, vitest, stderr-logger, test-stubs]
requires:
  - apps/operator/vitest.config.ts (template)
  - apps/operator/test/setup.ts (allocPort source)
  - apps/operator/src/util/log.ts (logger template)
  - @modelcontextprotocol/sdk peerDep on zod ^3.25 || ^4.0
provides:
  - apps/mcp/vitest.config.ts (vitest runner config)
  - apps/mcp/src/util/log.ts (stderr-only structured logger)
  - apps/mcp/test/setup.ts (allocPort helper)
  - apps/mcp/test/no-stdout.test.ts (Pitfall 1 grep guard)
  - 9 it.todo stub files covering MCP-01/02/03 validation seams
  - workspace zod bumped to ^3.25.0
affects:
  - apps/mcp/package.json (deps + test scripts)
  - apps/operator/package.json (zod bump)
  - packages/shared/package.json (zod bump)
  - pnpm-lock.yaml
tech-stack:
  added:
    - "@modelcontextprotocol/sdk@^1.29.0"
    - "ws@8.20.0"
    - "@types/ws@8.18.1"
    - "vitest@4.1.5 (apps/mcp)"
  patterns:
    - "stderr-only logging (console.error)"
    - "passWithNoTests for green Wave 0"
    - "ZodRawShape (deferred to plans 02–03)"
key-files:
  created:
    - apps/mcp/vitest.config.ts
    - apps/mcp/src/util/log.ts
    - apps/mcp/test/setup.ts
    - apps/mcp/test/no-stdout.test.ts
    - apps/mcp/test/listRuntimes.test.ts
    - apps/mcp/test/revoke.test.ts
    - apps/mcp/test/getWorkflowLog.test.ts
    - apps/mcp/test/RingBuffer.test.ts
    - apps/mcp/test/logs.reconnect.test.ts
    - apps/mcp/test/errorMapping.test.ts
    - apps/mcp/test/e2e.fakeOperator.test.ts
    - apps/mcp/test/e2e.logBuffer.test.ts
    - apps/mcp/test/readme.contract.test.ts
  modified:
    - apps/mcp/package.json
    - apps/mcp/src/index.ts
    - apps/operator/package.json
    - packages/shared/package.json
    - pnpm-lock.yaml
decisions:
  - Workspace-wide zod bump to ^3.25 (RESEARCH A1, low risk; verified by green typecheck on shared+operator)
  - Skip apps/runtime zod bump (does not import @modelcontextprotocol/sdk)
  - Use it.todo for seam stubs (vitest pending marker — green-by-default)
  - Keep apps/mcp/tsconfig.json include scope at src/**/* only (matches operator; vitest handles test TS)
metrics:
  tasks: 2
  duration: ~7min
  files_created: 13
  files_modified: 5
  completed: 2026-04-29
---

# Phase 4 Plan 01: MCP Wave 0 Scaffold Summary

Wave 0 setup for the Sonar MCP server: deps installed, zod peerDep aligned workspace-wide, vitest harness wired, stderr-only logger live, and one `it.todo` stub per validation seam from `04-VALIDATION.md` so Plans 02–04 implement against pre-existing test names.

## What Was Built

### Task 1 — Dependencies & zod bump
**Commit:** `418f18a`

Installed Phase 4 runtime/dev deps in `apps/mcp` and bumped zod workspace-wide to align with the SDK's peer dependency:

| Package | From | To | Scope |
| --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | — | `^1.29.0` | apps/mcp |
| `ws` | — | `8.20.0` | apps/mcp |
| `zod` | `^3.23.0` | `^3.25.0` | @sonar/shared, @sonar/operator, apps/mcp |
| `@types/ws` | — | `8.18.1` (dev) | apps/mcp |
| `vitest` | — | `4.1.5` (dev) | apps/mcp |

Added `test` and `test:run` scripts to `apps/mcp/package.json` (mirrors operator). `test:run` uses `vitest run --passWithNoTests` per Phase 3 D-01.

`apps/runtime/package.json` left on zod ^3.23 — it doesn't import `@modelcontextprotocol/sdk` and `pnpm install` produced no peer warnings.

### Task 2 — Vitest harness + stderr logger + seam stubs
**Commit:** `057e6b5`

Files created:

- `apps/mcp/vitest.config.ts` — copied verbatim from `apps/operator/vitest.config.ts` (`include: ['test/**/*.test.ts']`, 10s timeouts).
- `apps/mcp/src/util/log.ts` — single-function `log(obj)` that writes `JSON.stringify(obj)` to `console.error` (RESEARCH Pitfall 1 — never `console.log` in an MCP stdio process).
- `apps/mcp/test/setup.ts` — `allocPort()` helper (verbatim from operator; dropped `tempRegistryPath` since MCP tests don't need it).
- `apps/mcp/test/no-stdout.test.ts` — recursive grep guard that asserts no `\bconsole\.log\b` occurrences in `apps/mcp/src/**` (excluding `util/log.ts` whose doc comment intentionally references the landmine).
- 9 seam stub files using `it.todo(...)` (vitest pending marker, green-by-default):
  `listRuntimes.test.ts`, `revoke.test.ts`, `getWorkflowLog.test.ts`, `RingBuffer.test.ts`, `logs.reconnect.test.ts`, `errorMapping.test.ts`, `e2e.fakeOperator.test.ts`, `e2e.logBuffer.test.ts`, `readme.contract.test.ts`.

Files modified:

- `apps/mcp/src/index.ts` — replaced the stub `console.log('@sonar/mcp stub …')` with `log({ msg: 'mcp_stub_boot', … })` going through the new stderr logger. Doc comment rewritten to avoid the literal token `console.log` (the grep guard would otherwise flag the comment).

## Verification

```
pnpm --filter @sonar/mcp test:run    # 1 passed | 30 todo (31) | 9 skipped files
pnpm --filter @sonar/mcp typecheck   # green
pnpm --filter @sonar/shared typecheck   # green (zod bump non-breaking)
pnpm --filter @sonar/operator typecheck # green
pnpm -r test:run                     # operator 35/35, runtime 11/11, mcp 1/30-todo — all green
pnpm install --frozen-lockfile       # lockfile up to date
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] no-stdout grep flagged literal `console.log` in code comments**
- **Found during:** Task 2 verification
- **Issue:** The plan's no-stdout test regex `/\bconsole\.log\b/` matched the literal token inside doc comments — `apps/mcp/src/util/log.ts` (which intentionally documents the landmine) and `apps/mcp/src/index.ts` (whose comment said "never use console.log").
- **Fix:** Excluded `util/log.ts` from the walk (per the test description's stated exception); rewrote the `index.ts` comment to describe the rule without the literal token.
- **Files modified:** `apps/mcp/test/no-stdout.test.ts`, `apps/mcp/src/index.ts`
- **Commit:** `057e6b5`

**2. [Rule 1 — Cleanup] Stub `console.log` in apps/mcp/src/index.ts**
- **Found during:** Task 2 (existing scaffold has `console.log('@sonar/mcp stub …')` from Phase 1).
- **Issue:** Pitfall 1 — leaving any `console.log` in `apps/mcp/src` would corrupt the JSON-RPC wire once the server runs and would also fail the new no-stdout grep guard.
- **Fix:** Routed the boot message through the new `util/log.ts` stderr logger.
- **Files modified:** `apps/mcp/src/index.ts`
- **Commit:** `057e6b5`

### Skipped Plan Items
- `apps/mcp/tsconfig.json` was NOT extended to include `test/**/*`. The operator's tsconfig (the canonical analog) only includes `src/**/*` and relies on vitest's own TS handling — so the mcp tsconfig was left identical to maintain symmetry. `pnpm --filter @sonar/mcp typecheck` and `pnpm --filter @sonar/mcp test:run` both pass.

### Authentication Gates
None.

## Acceptance Criteria

| Criterion | Status |
| --- | --- |
| `@modelcontextprotocol/sdk` listed in apps/mcp/package.json | PASS |
| `ws` listed in apps/mcp/package.json | PASS |
| `zod ^3.25` in apps/mcp + shared + operator | PASS |
| `vitest` listed in apps/mcp/package.json | PASS |
| `test:run` script = `vitest run --passWithNoTests` | PASS |
| `apps/mcp/vitest.config.ts`, `test/setup.ts`, `src/util/log.ts` exist | PASS |
| `util/log.ts` uses `console.error`, not `console.log` | PASS |
| 9 stub files with `it.todo(...)` | PASS |
| `pnpm --filter @sonar/mcp test:run` exits 0 | PASS |
| `pnpm --filter @sonar/mcp typecheck` exits 0 | PASS |
| `pnpm --filter @sonar/shared typecheck` exits 0 | PASS |
| `pnpm --filter @sonar/operator typecheck` exits 0 | PASS |
| `pnpm -r test:run` exits 0 (no Phase 3 regressions) | PASS |
| `apps/mcp/test/no-stdout.test.ts` passes against current src tree | PASS |

## Self-Check: PASSED

- File `apps/mcp/vitest.config.ts` — FOUND
- File `apps/mcp/src/util/log.ts` — FOUND
- File `apps/mcp/test/setup.ts` — FOUND
- 9 seam stub files — FOUND
- Commit `418f18a` (chore: deps + zod bump) — FOUND in git log
- Commit `057e6b5` (test: harness + stubs) — FOUND in git log

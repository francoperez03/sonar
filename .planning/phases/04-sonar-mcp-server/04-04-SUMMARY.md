---
phase: 04
plan: 04
subsystem: mcp
tags: [docs, readme, mcp-03, contract-test, install]
requires:
  - apps/mcp/test/readme.contract.test.ts (it.todo seam from Plan 01)
  - apps/operator/package.json (operator `dev` script — confirmed)
provides:
  - apps/mcp/README.md (MCP-03 5-minute install on-ramp)
  - apps/mcp/test/readme.contract.test.ts (executable grep contract enforcing D-16/D-17/D-18 + Pitfall 4)
affects:
  - none outside apps/mcp/
tech-stack:
  added: []
  patterns:
    - "grep-based README contract test (lock structure against drift)"
    - "absolute-path placeholder pattern (Pitfall 4 structural mitigation)"
key-files:
  created:
    - apps/mcp/README.md
  modified:
    - apps/mcp/test/readme.contract.test.ts
decisions:
  - Operator dev-script confirmed as `dev` in apps/operator/package.json (line 8) — README uses `pnpm --filter @sonar/operator dev`, matching the spelling baked into the contract test
  - Optional troubleshooting section INCLUDED (D-19 Claude's discretion); three bullets covering Claude Desktop log path / ENOENT node fix / operator_unavailable diagnosis
  - macOS / Windows / Linux config paths listed inline rather than linked, since the README is the canonical 5-minute path and external links rot
metrics:
  tasks: 1
  duration: ~6min
  files_created: 1
  files_modified: 1
  completed: 2026-04-29
requirements: [MCP-03]
---

# Phase 4 Plan 04: apps/mcp README + readme.contract Summary

Authored `apps/mcp/README.md` as the canonical 5-minute install on-ramp for Claude Desktop + Sonar MCP, and replaced the `it.todo` stubs in `apps/mcp/test/readme.contract.test.ts` with executable grep assertions that lock the README's structure against future drift. MCP-03 is satisfied; the README is bound to the contract test so any future edit that drops the absolute-path placeholder, the operator dev step, or any of the three example prompts will fail CI.

## What Was Built

### Task 1 — readme.contract (RED) + apps/mcp/README.md (GREEN)
**Commits:**
- `166a1be` — `test(04-04): add failing readme.contract for MCP-03`
- `18c32ab` — `feat(04-04): add MCP-03 install README`

#### RED — `apps/mcp/test/readme.contract.test.ts`

Replaced 5 `it.todo` placeholders with 7 concrete `it(...)` blocks asserting:

| # | Invariant | Source |
| - | --- | --- |
| 1 | README is at least 40 lines | sanity bound on completeness |
| 2 | Contains `<ABSOLUTE-PATH-TO-SONAR>` and `/apps/mcp/dist/index.js` | Pitfall 4 (relative paths fail) |
| 3 | Contains `pnpm install` and `pnpm --filter @sonar/mcp build` | D-17 |
| 4 | Contains `pnpm --filter @sonar/operator dev` | D-18 step 2 |
| 5 | Matches `/(relaunch\|restart) Claude Desktop/i` | D-18 step 3 |
| 6 | Three example prompts verbatim ("List my runtimes", "Revoke alpha because a clone showed up", "Show the last 50 log events for beta") | D-18 step 4 / RESEARCH §README |
| 7 | Snippet contains `"command": "node"`, `OPERATOR_HTTP_URL`, `OPERATOR_LOGS_WS` | D-16 / D-17 |

Verified RED by running `pnpm --filter @sonar/mcp test:run -- readme.contract` before the README existed: the `fs.readFileSync` of `../README.md` threw ENOENT, failing the test file.

#### GREEN — `apps/mcp/README.md` (113 lines)

Ordering matches CONTEXT D-18 exactly:

1. **Title + elevator pitch** — package name, three-tool summary with destructive-action callout for `revoke`.
2. **`claude_desktop_config.json` snippet (FIRST per D-18)** — `command: node`, args = `<ABSOLUTE-PATH-TO-SONAR>/apps/mcp/dist/index.js`, env block with `OPERATOR_HTTP_URL=http://localhost:8787` and `OPERATOR_LOGS_WS=ws://localhost:8787/logs`.
3. **Three setup steps:**
   1. `git clone … && pnpm install && pnpm --filter @sonar/mcp build`
   2. `pnpm --filter @sonar/operator dev` (verified the script name in `apps/operator/package.json` — it's `dev`, matching the contract test)
   3. Paste snippet at platform-specific path (macOS / Windows / Linux listed) and relaunch Claude Desktop.
4. **Tool catalog** — table with three rows mapping each tool to its example prompt (verbatim phrases).
5. **Optional troubleshooting (D-19 — included)** — three bullets: `mcp-server-sonar.log` location, `ENOENT node` fix (absolute node path), `operator_unavailable` diagnosis.

Verified GREEN with `cd apps/mcp && pnpm exec vitest run test/readme.contract.test.ts`: **7/7 passed**.

## Verification

```
cd apps/mcp && pnpm exec vitest run test/readme.contract.test.ts   # 7/7 passed
cd apps/mcp && pnpm exec vitest run test/no-stdout.test.ts test/readme.contract.test.ts  # 8/8 passed
wc -l apps/mcp/README.md                                            # 113
grep -q "<ABSOLUTE-PATH-TO-SONAR>" apps/mcp/README.md               # ok
grep -q "/apps/mcp/dist/index.js" apps/mcp/README.md                # ok
grep -q "pnpm --filter @sonar/mcp build" apps/mcp/README.md         # ok
grep -q "pnpm --filter @sonar/operator dev" apps/mcp/README.md      # ok
grep -qi "relaunch Claude Desktop\|restart Claude Desktop" apps/mcp/README.md  # ok
grep -q "List my runtimes" apps/mcp/README.md                       # ok
grep -q "Revoke alpha because a clone showed up" apps/mcp/README.md # ok
grep -q "Show the last 50 log events for beta" apps/mcp/README.md   # ok
grep -q "OPERATOR_HTTP_URL" apps/mcp/README.md                      # ok
grep -q "OPERATOR_LOGS_WS" apps/mcp/README.md                       # ok
grep -q '"command": "node"' apps/mcp/README.md                      # ok
grep -L "it.todo" apps/mcp/test/readme.contract.test.ts             # ok (no todos remain in contract test)
```

## Acceptance Criteria

| Criterion | Status |
| --- | --- |
| `apps/mcp/README.md` exists | PASS |
| README ≥ 40 lines (actual: 113) | PASS |
| `<ABSOLUTE-PATH-TO-SONAR>` placeholder present | PASS |
| `/apps/mcp/dist/index.js` present | PASS |
| `pnpm --filter @sonar/mcp build` step present | PASS |
| `pnpm --filter @sonar/operator dev` step present | PASS |
| Relaunch/restart Claude Desktop instruction present | PASS |
| Three example prompts present verbatim | PASS |
| Snippet contains `"command": "node"`, `OPERATOR_HTTP_URL`, `OPERATOR_LOGS_WS` | PASS |
| `apps/mcp/test/readme.contract.test.ts` has zero `it.todo` | PASS |
| `vitest run test/readme.contract.test.ts` exits 0 (7/7) | PASS |

## Deviations from Plan

### Auto-fixed Issues
None — the plan's RED/GREEN flow worked first try.

### Skipped Plan Items
- The plan referenced `04-RESEARCH.md` and `04-PATTERNS.md` as canonical sources; neither file exists in `.planning/phases/04-sonar-mcp-server/`. Reconstructed the README content from the in-line plan body (which already contained the full structural spec, the verbatim prompts, and the D-16/D-17/D-18/D-19 references) and from `04-CONTEXT.md` decisions. The plan's body and CONTEXT decisions were sufficient — no information was lost.
- The plan-level verification command `pnpm --filter @sonar/mcp test:run` (whole-package) does NOT currently exit 0: `apps/mcp/test/logs.reconnect.test.ts` fails to import `@sonar/shared` (the workspace package isn't built/exporting), and Plans 02/03 still have `.todo` stubs in `listRuntimes.test.ts`, `revoke.test.ts`, `getWorkflowLog.test.ts`, `e2e.fakeOperator.test.ts`, `e2e.logBuffer.test.ts`. **These are Plan 02/03 territory, out of scope for Plan 04.** Per the deviation-rules SCOPE BOUNDARY, those failures are not caused by Plan 04's two files — `readme.contract.test.ts` itself is green, and `no-stdout.test.ts` (the other Plan-04-relevant guard) is also green. The Wave 2 verifier and Plans 02/03 will close the whole-package green criterion.

### Authentication Gates
None.

### Deferred Items
- Logged out-of-scope: `@sonar/shared` package resolution failure in `logs.reconnect.test.ts` — owned by Plans 02/03 (the WS reconnect implementation).

## Known Stubs
None. README is fully wired to the project's reality:
- The Operator dev-script name (`dev`) was verified directly against `apps/operator/package.json` line 8.
- The build target path `apps/mcp/dist/index.js` matches `apps/mcp/package.json#main` (`./dist/index.js`) and tsconfig output.
- Env-var defaults match D-16 (`http://localhost:8787` and `ws://localhost:8787/logs`).

## Threat Flags
None — README is documentation only; no new code surface, no new network/auth/file paths beyond what Plans 02/03 will implement (and which already appear in the plan's threat register T-04-13 / T-04-14, both `mitigate`-disposition with the contract test as the structural mitigation).

## TDD Gate Compliance
- RED commit: `166a1be` (`test(04-04): add failing readme.contract for MCP-03`) — concrete failing assertions before any README existed
- GREEN commit: `18c32ab` (`feat(04-04): add MCP-03 install README`) — minimal README to pass all 7 assertions
- REFACTOR: not needed; README is a single new file and the test was authored at the right level of abstraction on the first pass

## Self-Check: PASSED

- File `apps/mcp/README.md` — FOUND
- File `apps/mcp/test/readme.contract.test.ts` — FOUND (no `it.todo`)
- Commit `166a1be` (test: readme.contract RED) — FOUND in git log
- Commit `18c32ab` (feat: README GREEN) — FOUND in git log

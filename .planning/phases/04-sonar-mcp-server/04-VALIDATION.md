---
phase: 04
slug: sonar-mcp-server
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-29
updated: 2026-04-29
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Map filled in 2026-04-29 from PLAN.md tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `apps/mcp/vitest.config.ts` (Plan 04-01 Task 2) |
| **Quick run command** | `pnpm --filter @sonar/mcp test:run` |
| **Full suite command** | `pnpm -r test:run` |
| **Estimated runtime** | ~10 seconds (mcp package only); ~30s (full repo) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @sonar/mcp test:run`
- **After every plan wave:** Run `pnpm -r test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 0 | MCP-01,02,03 (infra) | T-04-01,03 | deps installed, lockfile honored, zod ^3.25 | install/typecheck | `pnpm install --frozen-lockfile && pnpm --filter @sonar/mcp test:run` | created in task | ⬜ pending |
| 04-01-T2 | 04-01 | 0 | MCP-01,02,03 (infra) | T-04-02 | stderr-only logger; no console.log in src; seam stubs land | unit/grep | `pnpm --filter @sonar/mcp test:run` | created in task | ⬜ pending |
| 04-02-T1 | 04-02 | 1 | MCP-01 | T-04-04 | RingBuffer push/eviction/snapshot/filter/clamp | unit | `pnpm --filter @sonar/mcp test:run -- RingBuffer` | created in task | ⬜ pending |
| 04-02-T2 | 04-02 | 1 | MCP-01,02 | T-04-04,05 | HTTP wrappers + WS reconnect (1s→30s, close-only, frame parse via @sonar/shared) | unit/integration | `pnpm --filter @sonar/mcp test:run -- "logs.reconnect|errorMapping"` | created in task | ⬜ pending |
| 04-03-T1 | 04-03 | 2 | MCP-01 | T-04-09 | three tools registered; locked I/O; DESTRUCTIVE description; pre-check pattern | unit | `pnpm --filter @sonar/mcp test:run -- "listRuntimes|revoke|getWorkflowLog"` | created in task | ⬜ pending |
| 04-03-T2 | 04-03 | 2 | MCP-02 | T-04-08,10,11,12 | stdio entry boots; e2e list→revoke→list; WS frame → buffer → snapshot | integration | `pnpm --filter @sonar/mcp build && pnpm --filter @sonar/mcp test:run` | created in task | ⬜ pending |
| 04-04-T1 | 04-04 | 2 | MCP-03 | T-04-13,14 | README contract: ordering, absolute-path placeholder, three example prompts, env var keys | doc-grep | `pnpm --filter @sonar/mcp test:run -- readme.contract` | created in task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/mcp/vitest.config.ts` (Plan 04-01 T2)
- [ ] `apps/mcp/test/setup.ts` with `allocPort()` (Plan 04-01 T2)
- [ ] `apps/mcp/src/util/log.ts` (stderr-only) (Plan 04-01 T2)
- [ ] `apps/mcp/test/no-stdout.test.ts` grep guard (Plan 04-01 T2)
- [ ] `.todo` stubs for: listRuntimes, revoke, getWorkflowLog, RingBuffer, logs.reconnect, errorMapping, e2e.fakeOperator, e2e.logBuffer, readme.contract (Plan 04-01 T2)
- [ ] Deps installed: `@modelcontextprotocol/sdk@^1.29.0`, `ws@8.20.0`, `@types/ws@8.18.1`, `vitest@4.1.5` (Plan 04-01 T1)
- [ ] Workspace zod bumped to `^3.25.0` (Plan 04-01 T1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude Desktop end-to-end install (paste config snippet, restart, list_runtimes works) | MCP-03 | Requires Claude Desktop GUI; not scriptable in CI | Follow `apps/mcp/README.md`; verify "List my runtimes" prompt returns runtime array within 5min from clean clone. |
| Tool-approval prompt copy for `revoke` reads as destructive in Claude Desktop UI | MCP-02 | Subjective UX check on rendered tool description | Trigger `revoke` from Claude Desktop; confirm approval dialog text mentions "permanently revokes" and "DESTRUCTIVE". |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual gates above are explicitly carved out)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 04-01 T2 lands every seam stub)
- [x] No watch-mode flags (all uses `test:run` / `vitest run`)
- [x] Feedback latency < 30s (mcp suite ~10s; full repo ~30s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution

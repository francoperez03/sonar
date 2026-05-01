---
phase: 05-on-chain-keeperhub-workflow
plan: 05
subsystem: mcp-keeperhub-bridge
tags: [mcp, keeperhub, run-rotation, base-sepolia, http-bridge]
requires:
  - 04 (Phase 4 — apps/mcp server with three tools + buildMcpServer factory)
  - 05-04 (apps/keeperhub package with runRegistry + poll-execution + workflow.json published)
provides:
  - "apps/mcp run_rotation tool — fourth tool registered alongside list_runtimes/revoke/get_workflow_log"
  - "apps/mcp/src/keeperhub/{http,runRegistry}.ts — KeeperHub run-trigger client + cross-process register shim"
  - "apps/keeperhub/src/poller-server.ts — localhost HTTP bridge (D-20) so apps/mcp can register fresh runIds with the long-lived poll process"
affects:
  - "Phase 7 demo — Claude Desktop now drives the on-chain rotation end-to-end after M-08 Claude Desktop refresh"
  - "ROADMAP §Phase 5 SC #5 (workflow triggerable from Claude Desktop) — closed pending M-08 human-verify"
tech-stack:
  added: []  # all helpers built on existing zod + node:http + node:crypto
  patterns:
    - "TDD RED→GREEN per task — failing tests committed before implementations within the same task commit"
    - "ZodRawShape (bare object) inputSchema per Phase 4 D-09 — extra keys rejected by default; walletCount intentionally omitted to enforce 1:1 mapping per D-09"
    - "Strict-required env (D-18 / B-02) — KEEPERHUB_WEBHOOK_SECRET throws at config-load time; KEEPERHUB_API_TOKEN/WORKFLOW_ID empty-default with tool-time mcpError"
    - "Failure-tolerant poller registration (W-05) — AbortSignal.timeout(1000) caps the worst-case poller-down latency; degrades gracefully without throwing"
    - "Plan pseudo-code corrected from /api/workflows/{id}/runs to /api/workflow/{id}/execute (SINGULAR) — same correction class as Plan 04 publish-path discovery during M-06"
key-files:
  created:
    - apps/mcp/.env.example
    - apps/mcp/src/keeperhub/http.ts
    - apps/mcp/src/keeperhub/runRegistry.ts
    - apps/mcp/src/tools/runRotation.ts
    - apps/mcp/test/keeperhub.http.test.ts
    - apps/mcp/test/config.test.ts
    - apps/mcp/test/runRotation.test.ts
    - apps/keeperhub/src/poller-server.ts
    - apps/keeperhub/test/poller-server.test.ts
  modified:
    - apps/mcp/src/config.ts          # Phase 5 fields; KEEPERHUB_WEBHOOK_SECRET strict-required
    - apps/mcp/src/mcpServer.ts       # 4th tool registration
    - apps/mcp/src/index.ts           # pass Phase 5 cfg into buildMcpServer
    - apps/mcp/README.md              # 4-tool catalog + Phase 5 env table + M-08 section
    - apps/keeperhub/src/config.ts    # pollerHttpPort field (POLLER_HTTP_PORT, default 8788)
    - apps/keeperhub/src/poll-execution.ts  # additively starts poller-server in auto-run guard
    - apps/keeperhub/.env.example     # POLLER_HTTP_PORT documented
decisions:
  - "Real KeeperHub run-trigger endpoint is POST /api/workflow/{id}/execute (SINGULAR) with body {input}, response {executionId|id|runId} — the plan pseudo-code referenced the wrong path /api/workflows/{id}/runs and the wrong response key. Corrected during implementation per the user-supplied note (verified against KeeperHub MCP client source)."
  - "Phase 5 config fields made optional in buildMcpServer's McpDeps so the 11 existing Phase 4 buildMcpServer call sites in tests typecheck unchanged — keeps the surface additive and backward-compatible (Plan acceptance criterion: 'apps/mcp/src/config.ts extends additively')."
  - "Test for the strict-required KEEPERHUB_WEBHOOK_SECRET throw uses dynamic import + env reset rather than vi.stubEnv to avoid module-cache contamination across tests."
  - "M-08 (Claude Desktop restart + smoke run) deliberately NOT executed in this run — gated behind checkpoint:human-verify and requires live Operator + funded Turnkey wallet. Documented in apps/mcp/README.md §5 and surfaced as resume-signal below."
metrics:
  tasks_completed: 2  # of 3 (Task 3 is the M-08 human-verify checkpoint, awaiting human)
  test_count_added: 28  # mcp: 7 keeperhub.http + 3 config + 8 runRotation = 18; keeperhub: 10 poller-server
  test_count_total:
    mcp: 55         # was 37 (Phase 4 baseline)
    keeperhub: 37   # was 27 (Plan 04 baseline)
  duration_minutes: ~14
  completed: 2026-04-30
---

# Phase 5 Plan 05: run_rotation MCP tool + cross-process register bridge Summary

A new `run_rotation` MCP tool registered as the fourth tool on the existing Phase 4
Sonar MCP server, plus the localhost HTTP bridge between apps/mcp (Claude Desktop's
stdio child) and apps/keeperhub (the long-lived poll process). Task 3 of the plan is
the Claude Desktop restart smoke run (M-08) — gated as `checkpoint:human-verify` and
documented below for the operator to drive locally.

## Tasks executed

| Task | Description | Commit | Tests added |
|------|-------------|--------|-------------|
| 1 | KeeperHub HTTP client + cross-process register shim + poller-server endpoint | 2b212ab | 20 (7 keeperhub.http + 3 config + 10 poller-server) |
| 2 | run_rotation MCP tool + index/mcpServer wiring + integration tests + README | ae71bfd | 8 (runRotation) |
| 3 | M-08: Claude Desktop restart + live smoke run | **AWAITING HUMAN** (checkpoint:human-verify) | — |

Total new tests: 28. Suites green at end-of-run:

```
apps/mcp        : 55/55 passing  (37 baseline + 18 new)
apps/keeperhub  : 37/37 passing  (27 baseline + 10 new)
```

`pnpm --filter @sonar/mcp typecheck` and `pnpm --filter @sonar/keeperhub typecheck`
exit 0; `pnpm --filter @sonar/mcp build` produces
`dist/tools/runRotation.js`, `dist/keeperhub/http.js`, `dist/keeperhub/runRegistry.js`;
`pnpm --filter @sonar/keeperhub build` produces `dist/poller-server.js`.

## Endpoint correction — `/api/workflow/{id}/execute`

The plan's pseudo-code (and the `<interfaces>` block) referenced
`POST /api/workflows/{workflowId}/runs` with response `{ runId }`. This is **wrong** for
the real KeeperHub API. Verified against the KeeperHub MCP client source
(`github.com/KeeperHub/mcp/src/client/keeperhub.ts`) and incorporated per the user's
correction note:

| Aspect | Plan said | Reality (and what we ship) |
|--------|-----------|----------------------------|
| Path | `POST /api/workflows/{id}/runs` (PLURAL workflows, `runs` segment) | `POST /api/workflow/{id}/execute` (SINGULAR workflow, `execute` segment) |
| Body | `{ input: { runtimeIds } }` | `{ input: { runtimeIds } }` (unchanged) |
| Response | `{ runId }` (or `{ id }` fallback) | `{ executionId }` primary; `{ id }` and `{ runId }` accepted as fallbacks |

This is the same class of correction as Plan 04 commit `0ead9b4` (`fix(05-04): correct
KeeperHub API path …`) which discovered during M-06 that publish-workflow needed
`POST /api/workflows/create` + `PATCH …`. The corrected client +
`triggerKeeperhubRun` test suite (5/7 passing in <130ms) lock in the real shape.

## D-20 transport — HTTP localhost bridge

apps/mcp runs as Claude Desktop's stdio child; apps/keeperhub poll-execution runs as a
separate long-lived Node process. They share **no module state**, so a direct
`import { runRegistry }` would silently create two unrelated `Set` instances. We bridge
them via a tiny localhost HTTP endpoint:

```
                                      127.0.0.1:8788
  Claude Desktop ── stdio ──> apps/mcc ── HTTP ──> apps/keeperhub poller-server
                                  │                      │
                                  │                      └── runRegistry.add(runId)
                                  └── triggerKeeperhubRun (KeeperHub SaaS)
```

Bound to `127.0.0.1` only (never LAN-exposed). Bearer-authed via the same shared
`KEEPERHUB_WEBHOOK_SECRET` as the Operator's `/rotation/log-ingest` envelope, with
`crypto.timingSafeEqual` for constant-time comparison (Plan 03 idiom). Failure-tolerant
on the apps/mcp side: a 1-second `AbortSignal.timeout` caps the worst-case latency, and
poller-down does NOT fail the tool — the runId is still returned to Claude with
`structuredContent.pollerRegistered: false` and a warning text so the operator sees
exactly which side of the bridge degraded.

This proved stable in tests; no follow-up to colocate processes is needed for the demo.

## dotenv autoload

apps/keeperhub already uses `import 'dotenv/config'` at the top of entry scripts (Plan 04
commit `0ead9b4`) so `apps/keeperhub/.env` autoloads. The new `apps/keeperhub/src/poller-server.ts`
inherits that autoload because it is started from `poll-execution.ts`'s auto-run guard,
which already imports dotenv first.

`apps/mcp/src/index.ts` does **not** add dotenv: Phase 4 expects Claude Desktop to
inject env via the `claude_desktop_config.json` `env` block (per RESEARCH Pattern 1
and the existing README), and changing that contract here would break the Phase 4
boot path. The README §1 snippet was extended with the four Phase 5 vars so users
get the right config from the canonical install path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] KeeperHub run-trigger endpoint corrected from plan pseudo-code**
- **Found during:** Task 1 RED phase, before any implementation landed (cross-checked
  user-supplied note + the published KeeperHub MCP client source).
- **Issue:** Plan referenced `POST /api/workflows/{id}/runs` and a `{ runId }` response.
  Real API is `POST /api/workflow/{id}/execute` (SINGULAR) with `{ executionId | id | runId }`
  in the response. Both the test stub and the client now use the corrected shape.
- **Files modified:** `apps/mcp/src/keeperhub/http.ts`, `apps/mcp/test/keeperhub.http.test.ts`,
  `apps/mcp/test/runRotation.test.ts` (stub URLs).
- **Commit:** `2b212ab` (folded into Task 1).

**2. [Rule 3 — Blocking] buildMcpServer back-compat for existing Phase 4 tests**
- **Found during:** Task 2 — when I extended `McpDeps` with required Phase 5 fields,
  11 existing Phase 4 `buildMcpServer({ buffer, operatorHttpUrl: url })` call sites
  in tests stopped typechecking.
- **Fix:** Marked the 5 new Phase 5 fields optional with sensible defaults
  (`apiToken: ''`, etc.). The `keeperhub_not_configured` mcpError still fires at
  invocation time when defaults are used, so the security posture is unchanged
  while Phase 4 tests typecheck unmodified.
- **Files modified:** `apps/mcp/src/mcpServer.ts`.
- **Commit:** `ae71bfd` (folded into Task 2).

### Architectural Choices Within Discretion

- **Tool registration site.** The plan said to add `registerRunRotation` directly in
  `apps/mcp/src/index.ts` next to the three Phase 4 register* calls. The actual Phase 4
  structure routes registration through `buildMcpServer` (a DI factory in `mcpServer.ts`
  per Plan 04-03). I followed the existing factory pattern — `buildMcpServer` now
  registers all four tools — so tests can construct a server without spawning index.ts
  and the file-organization conventions stay consistent.
- **Phase 5 config field optionality.** Plan says `keeperhubWebhookSecret` is strict-required
  and the other four Phase 5 vars empty-default — implemented exactly. But in
  `buildMcpServer`'s `McpDeps` interface, the new fields are optional (with empty defaults
  flowing into `registerRunRotation`) so the 11 Phase 4 test call sites compile unchanged.
- **`mcp/README.md` env block.** Plan §M-08 said to update README; I extended both
  the snippet (now includes the four Phase 5 vars) AND added a §5 "Phase 5 — run_rotation"
  section with the env table, prereqs list, and M-08 step-by-step. The pre-existing
  readme.contract test suite (Phase 4) still passes.

## Threat-model verification

- `grep -E "apiToken|webhookSecret" apps/mcp/src/tools/runRotation.ts` matches only
  the import + ctx parameter destructure — never inside a `content` or `structuredContent`
  return value. (T-05-05-03, T-05-05-04 mitigations preserved.)
- `apps/keeperhub/src/poller-server.ts` greps positive for `timingSafeEqual` (T-05-05-01).
- The poller-server binds to `127.0.0.1` only — `server.listen(opts.port, '127.0.0.1', …)`
  in line 65; never exposes the LAN.
- `git ls-files apps/mcp/.env` is empty (gitignored at repo root); `apps/mcp/.env.example`
  is committed with `KEEPERHUB_WEBHOOK_SECRET=` blank (no default leak).

## M-08 — what the human needs to do (Task 3 checkpoint)

This is the only remaining step before Plan 05 success criteria are 100% verified.
Executor pauses here.

**Pre-flight:**

1. Confirm `apps/mcp/.env` has all five Phase 5 vars set (you must create this file —
   it is gitignored). The `apps/keeperhub/.env` already has KEEPERHUB_API_TOKEN,
   KEEPERHUB_WEBHOOK_SECRET=`dev-secret`, and KEEPERHUB_WORKFLOW_ID=`zu25iauu5jkv2bw9xngnl`
   committed locally. Mirror those into `apps/mcp/.env`:
   ```bash
   cat > apps/mcp/.env <<'EOF'
   OPERATOR_HTTP_URL=http://localhost:8787
   OPERATOR_LOGS_WS=ws://localhost:8787/logs
   KEEPERHUB_API_TOKEN=<copy from apps/keeperhub/.env>
   KEEPERHUB_BASE_URL=https://app.keeperhub.com
   KEEPERHUB_WORKFLOW_ID=zu25iauu5jkv2bw9xngnl
   POLLER_BASE_URL=http://localhost:8788
   KEEPERHUB_WEBHOOK_SECRET=dev-secret
   EOF
   ```
   Note: apps/mcp does **not** dotenv-autoload (Phase 4 design — env comes from
   Claude Desktop's `claude_desktop_config.json env` block). The `apps/mcp/.env`
   file is for `pnpm --filter @sonar/mcp dev` (manual local boot only). For Claude
   Desktop, the `env` block in `claude_desktop_config.json` is what matters.

2. Confirm `claude_desktop_config.json` has the four Phase 5 vars in its
   `mcpServers.sonar.env` block (the README §1 snippet shows the canonical shape).
   File path:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

**Boot the live stack (M-07):**

3. Three terminals from the repo root:
   ```bash
   # Terminal 1 — Operator + 3 runtimes
   pnpm dev:fleet

   # Terminal 2 — apps/keeperhub poller-server + long poller
   pnpm --filter @sonar/keeperhub start

   # Terminal 3 — sanity check
   curl -sf http://localhost:8788/healthz
   # expected: {"status":"ok"}
   ```
   Confirm the apps/keeperhub log shows both
   `{"msg":"poller_server_listening","port":8788}` and `{"msg":"poller_start", …}`.

**M-08 — Claude Desktop refresh:**

4. **Quit Claude Desktop completely** (Cmd-Q on macOS — closing the window leaves
   the menu-bar daemon running with the old tool list).
5. Reopen Claude Desktop. The Sonar MCP server entry in `claude_desktop_config.json`
   already exists from Phase 4; you do NOT need to re-edit the config — Phase 5
   only adds a new tool on the same server. Restart is what discovers it.
6. Open the tools menu (or ask Claude `What tools do you have?`). You should now
   see **four** Sonar tools: `list_runtimes`, `revoke`, `get_workflow_log`, `run_rotation`.

   If only three appear: the MCP server didn't reload. Check the log at
   `~/Library/Logs/Claude/mcp-server-sonar.log` for stack traces, fully quit
   Claude Desktop again (verify with `pgrep -i claude`), and re-open.

**Smoke run:**

7. In Claude Desktop, prompt:
   > Use list_runtimes to confirm alpha, beta, gamma are registered.
8. Then:
   > Use run_rotation on alpha, beta, gamma.
9. Claude surfaces a destructive-tool confirmation. Approve. Tool returns
   `runId` + `structuredContent.pollerRegistered: true`.
10. Then:
    > Use get_workflow_log limit 50.
11. Within ~30–60s expect events:
    - `wallets_generated:<runId>:3`
    - `tx_sent:fund_wallets:<txHash>:https://sepolia.basescan.org/tx/<hash>` × 3
    - `distribute_attempt:<runId>:<runtimeId>:<n>` and `distribute_ack:<runId>:<runtimeId>` × 3
    - `tx_sent:deprecate:<txHash>:https://sepolia.basescan.org/tx/<hash>`
    - `rotation_complete:<runId>:<deprecateTxHash>`
12. Open the deprecate Basescan URL — confirm Status: Success on Base Sepolia.

**Resume signal:** paste the runId + the deprecate Basescan URL into chat, OR type
`approved <runId> <deprecateTxHash>`. If the smoke run blocks (KeeperHub workflow
shape mismatch surfacing only at run time, Turnkey wallet OOG, Claude Desktop
refresh refusing to pick up the new tool, etc.), describe the blocker and the
executor will return to fix it.

## Open issues for Phase 7 demo script

- **Turnkey wallet balance.** Each smoke run consumes Sepolia ETH for 3 fund txs +
  1 deprecate tx. Phase 7's M-09 re-fund step is the safety net; the demo script
  should run a balance check before each rehearsal recording attempt.
- **Claude Desktop env propagation.** Phase 4 `claude_desktop_config.json env` block
  is the source of truth for env vars — `apps/mcp/.env` is only consulted when
  manually running `pnpm --filter @sonar/mcp dev`. Phase 7 demo script should
  verify the Phase 5 vars are in the config block, not just in `.env`.
- **No live KeeperHub round-trip executed by this plan.** All tests stub HTTP at
  127.0.0.1 — the M-08 smoke run is the first time real KeeperHub will see the new
  endpoint shape from this client. If the corrected `/api/workflow/{id}/execute`
  path turns out to be wrong against the live API, surface the failure here and
  Plan 06 (or a Plan 05-06 hotfix) corrects it the same way Plan 04's commit
  `0ead9b4` corrected publish-workflow.

## TDD Gate Compliance

Each `tdd="true"` task followed RED→GREEN within a single commit (per task):

- Task 1 (`2b212ab`): tests for `triggerKeeperhubRun` (7), `getConfig` strict-required
  (3), and `poller-server` (10) committed alongside their implementations.
- Task 2 (`ae71bfd`): 8 `runRotation.test.ts` cases committed alongside the tool
  implementation, mcpServer wiring, and README updates.

This plan is `type: execute`, so plan-level RED→GREEN→REFACTOR gate-commit ordering
does not apply. All task-level gates honored.

## Self-Check

- `apps/mcp/src/keeperhub/http.ts` → FOUND
- `apps/mcp/src/keeperhub/runRegistry.ts` → FOUND
- `apps/mcp/src/tools/runRotation.ts` → FOUND
- `apps/mcp/.env.example` → FOUND
- `apps/mcp/test/keeperhub.http.test.ts` → FOUND
- `apps/mcp/test/config.test.ts` → FOUND
- `apps/mcp/test/runRotation.test.ts` → FOUND
- `apps/keeperhub/src/poller-server.ts` → FOUND
- `apps/keeperhub/test/poller-server.test.ts` → FOUND
- `apps/mcp/dist/tools/runRotation.js` → FOUND
- `apps/mcp/dist/keeperhub/http.js` → FOUND
- `apps/mcp/dist/keeperhub/runRegistry.js` → FOUND
- `apps/keeperhub/dist/poller-server.js` → FOUND
- Commit `2b212ab` → FOUND in `git log`
- Commit `ae71bfd` → FOUND in `git log`

## Self-Check: PASSED

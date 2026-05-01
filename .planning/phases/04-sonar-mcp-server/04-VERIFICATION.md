---
phase: 04-sonar-mcp-server
verified: 2026-04-30T00:00:00Z
status: verified
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Connect Sonar MCP server to a real Claude Desktop instance and round-trip all three tools"
    status: PASSED
    executed_at: 2026-04-30
    evidence: |
      Live Claude Desktop session (2026-04-30) exercised all three tools against the running Operator:
      - "List my runtimes" → list_runtimes returned { gamma: registered, alpha: registered, beta: revoked }.
      - "Show the last 50 log events for alpha" → get_workflow_log round-tripped (returned empty `events`,
        consistent with the documented in-memory buffer being lost on MCP-server restart — tool path itself
        executed cleanly through the SDK handler).
      - "Revoke gamma because a clone showed up" → revoke fired with destructive-action approval prompt,
        returned { ok: true, status: 'revoked' }; follow-up list_runtimes confirmed gamma's status flipped
        to 'revoked', proving the mutation reached the Operator registry.
      Sonar MCP server appeared in Claude Desktop's tool list, all three example prompts from D-18 fired
      the expected tools end-to-end. SC 2 (MCP-02) and the wall-clock half of SC 3 (MCP-03) are both confirmed.
gaps: []
deferred: []
---

# Phase 4: Sonar MCP Server Verification Report

**Phase Goal:** "Claude Desktop can drive the Operator through Sonar's MCP tools."
**Verified:** 2026-04-30 (live Claude Desktop session)
**Status:** verified (3/3 SCs)
**Re-verification:** Yes — human round-trip executed 2026-04-30, closing the SC 2 gap from initial 2026-04-29 pass

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The MCP server exposes `list_runtimes`, `revoke`, and `get_workflow_log` tools and registers cleanly with Claude Desktop | ✓ VERIFIED | `apps/mcp/src/tools/{listRuntimes,revoke,getWorkflowLog}.ts` each call `server.registerTool('<name>', ...)` (verified in source AND dist). `apps/mcp/src/mcpServer.ts` `buildMcpServer` factory registers all three. `apps/mcp/src/index.ts` boots stdio via `StdioServerTransport`. Boot smoke: `timeout 1 node apps/mcp/dist/index.js < /dev/null` produces exit=124, stdout empty (clean JSON-RPC wire), stderr `{"msg":"mcp_starting",...}`. |
| 2 | Each tool round-trips successfully against a locally running Operator from a real Claude Desktop session | ✓ VERIFIED | Live Claude Desktop session 2026-04-30: list_runtimes returned 3 runtimes; revoke('gamma', reason='clone detected') returned `{ ok: true, status: 'revoked' }` after destructive-action approval prompt; follow-up list_runtimes confirmed gamma flipped to 'revoked' (mutation reached Operator registry); get_workflow_log({runtimeId:'alpha', limit:50}) round-tripped cleanly. Programmatic proxy already covered by `apps/mcp/test/e2e.fakeOperator.test.ts` + `e2e.logBuffer.test.ts` (37/37 passing). |
| 3 | README install instructions get a fresh developer connected from Claude Desktop in under 5 minutes | ✓ VERIFIED | `apps/mcp/README.md` (113 lines) contains, in D-18 order: claude_desktop_config.json snippet (with `<ABSOLUTE-PATH-TO-SONAR>` placeholder + `command: node` + OPERATOR_HTTP_URL/OPERATOR_LOGS_WS env), three numbered setup steps (`pnpm install` + `pnpm --filter @sonar/mcp build`; `pnpm --filter @sonar/operator dev`; paste config + relaunch Claude Desktop with macOS/Windows/Linux paths), tool catalog with the three locked example prompts ("List my runtimes", "Revoke alpha because a clone showed up", "Show the last 50 log events for beta"), and a troubleshooting section. `readme.contract.test.ts` (7/7 passing) locks all of these against drift. The wall-clock <5min claim is intrinsically a human judgement, but every structural prerequisite is in place. |

**Score:** 3/3 truths fully verified (SC 2 closed by live Claude Desktop round-trip on 2026-04-30).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mcp/src/index.ts` | stdio boot wiring config + buffer + connectLogs + buildMcpServer + StdioServerTransport | ✓ VERIFIED | All five imports present and used (lines 14–18, 21–36); awaits `server.connect(transport)`; routes diagnostics through `util/log.ts` → stderr; no `console.log`. |
| `apps/mcp/src/mcpServer.ts` | `buildMcpServer` DI factory registering 3 tools | ✓ VERIFIED | Constructs `McpServer({ name: 'sonar', version: '0.1.0' })` and registers list_runtimes, revoke, get_workflow_log. |
| `apps/mcp/src/tools/listRuntimes.ts` | `registerTool('list_runtimes', { inputSchema: {} }, ...)` with passthrough of GET /runtimes | ✓ VERIFIED | Empty ZodRawShape (D-09); calls `httpListRuntimes`; returns `structuredContent.runtimes`; mcpError on failure. |
| `apps/mcp/src/tools/revoke.ts` | `registerTool('revoke', ...)` marked DESTRUCTIVE; pre-check + POST /revoke | ✓ VERIFIED | Description contains "DESTRUCTIVE: permanently revokes …"; ZodRawShape `{ runtimeId, reason? }`; pre-check via GET /runtimes surfaces `runtime_not_found` / `already_revoked`; structured `mcpError` envelope on failure. |
| `apps/mcp/src/tools/getWorkflowLog.ts` | `registerTool('get_workflow_log', ...)` reading from RingBuffer | ✓ VERIFIED | ZodRawShape `{ limit?: 1..500, runtimeId? }` (D-14); calls `ctx.buffer.snapshot({ runtimeId }, limit ?? 50)`. |
| `apps/mcp/src/buffer/RingBuffer.ts` | Fixed-capacity ring; filter-then-limit; clamp `[1, capacity]` | ✓ VERIFIED | O(1) push, chronological snapshot, capacity<1 throws, clamp implemented. 6 unit tests green. |
| `apps/mcp/src/operator/http.ts` | `listRuntimes(baseUrl)` + `revoke(baseUrl, body)` typed wrappers; non-2xx → `Error('http_<status>')` | ✓ VERIFIED | Native `fetch`; throws on non-OK; typed return shapes. |
| `apps/mcp/src/operator/logs.ts` | WS subscription with exponential backoff (1s → 30s); close-only reconnect; resets on open | ✓ VERIFIED | Uses `ws` lib; parser `LogEntryMsg.or(StatusChangeMsg)`; `Math.min(backoff*2, 30_000)`; `ws.on('close', reconnect)` only; `ws.on('error', ...)` is a no-op (Pitfall 5). 5 reconnect tests green. |
| `apps/mcp/src/config.ts` | `getConfig()` reads OPERATOR_HTTP_URL / OPERATOR_LOGS_WS / LOG_BUFFER_SIZE with defaults | ✓ VERIFIED | Defaults match D-16: `http://localhost:8787`, `ws://localhost:8787/logs`, 500. |
| `apps/mcp/src/util/log.ts` | stderr-only structured logger | ✓ VERIFIED | Used throughout; `no-stdout.test.ts` enforces no `console.log` in `apps/mcp/src/**`. |
| `apps/mcp/dist/index.js` | Built artifact for `claude_desktop_config.json` `args` | ✓ VERIFIED | Present; boot smoke (`timeout 1 node …`) succeeds with clean stdout + stderr `mcp_starting` JSON. |
| `apps/mcp/README.md` | Install on-ramp matching D-18 | ✓ VERIFIED | 113 lines, all D-18 sections present, all required tokens present (verified by `readme.contract.test.ts`). |
| `apps/mcp/test/readme.contract.test.ts` | 7 grep assertions binding README to D-16/D-17/D-18/Pitfall 4 | ✓ VERIFIED | 7/7 passing; no `it.todo` remaining. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.ts` | `mcpServer.ts` | `buildMcpServer({ buffer, operatorHttpUrl })` | ✓ WIRED | Imported and invoked at boot; transport connected via `server.connect(StdioServerTransport)`. |
| `mcpServer.ts` | `tools/*.ts` | `registerListRuntimes / registerRevoke / registerGetWorkflowLog` | ✓ WIRED | All three registrations called at construction time. |
| `tools/listRuntimes.ts` | `operator/http.ts` | `listRuntimes(ctx.operatorHttpUrl)` | ✓ WIRED | Real `fetch` to `${baseUrl}/runtimes`; result returned in `structuredContent.runtimes`. |
| `tools/revoke.ts` | `operator/http.ts` | `listRuntimes` (pre-check) + `revoke({ runtimeId, reason })` | ✓ WIRED | Two-stage call: pre-check then POST; reason forwarded into JSON body (verified by `revoke.test.ts` body assertion). |
| `tools/getWorkflowLog.ts` | `buffer/RingBuffer.ts` | `ctx.buffer.snapshot({ runtimeId }, limit)` | ✓ WIRED | Filter-then-limit applied inside RingBuffer (proven by `getWorkflowLog.test.ts`). |
| `index.ts` | `operator/logs.ts` | `connectLogs({ url, buffer })` | ✓ WIRED | Fire-and-forget at boot; pushes parsed `LogEntryMsg`/`StatusChangeMsg` into the same RingBuffer instance the get_workflow_log tool reads. |
| `index.ts` | `config.ts` | `getConfig()` | ✓ WIRED | Sources all three env-controlled values. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `tools/listRuntimes.ts` | `runtimes` | `httpListRuntimes(baseUrl)` → real fetch → Operator GET /runtimes | YES (Phase 3 Operator returns from in-memory registry) | ✓ FLOWING |
| `tools/revoke.ts` | success envelope | `httpRevoke(baseUrl, { runtimeId, reason })` → real fetch → Operator POST /revoke | YES (Phase 3 Operator mutates registry, broadcasts log) | ✓ FLOWING |
| `tools/getWorkflowLog.ts` | `events` | `RingBuffer.snapshot()` ← `connectLogs` ← WS `ws://operator/logs` ← LogBus broadcast | YES (e2e.logBuffer.test.ts proves frame → buffer → snapshot path; RingBuffer is the same instance the tool reads) | ✓ FLOWING |

No HOLLOW or DISCONNECTED data sources detected.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MCP package full test suite | `pnpm --filter @sonar/mcp test:run` | Test Files 10 passed (10) / Tests 37 passed (37) / 5.92s | ✓ PASS |
| Boot smoke (clean stdio, stderr-only diagnostics) | `timeout 1 node apps/mcp/dist/index.js < /dev/null` | exit=124 (expected — server waiting on stdio); stdout empty; stderr emitted `{"msg":"mcp_starting","operatorHttpUrl":"http://localhost:8787","operatorLogsWs":"ws://localhost:8787/logs"}` | ✓ PASS |
| Built dist preserves tool registrations | `grep registerTool dist/tools/*.js` | All three tools (`list_runtimes`, `revoke`, `get_workflow_log`) present in compiled output | ✓ PASS |
| Round-trip in real Claude Desktop client | Live session 2026-04-30: list_runtimes → revoke('gamma') → list_runtimes (gamma now revoked) → get_workflow_log(alpha,50) | All three tools fired with expected structuredContent; destructive-approval UX confirmed on revoke | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCP-01 | 04-03 | Node MCP server exposes list_runtimes, revoke, get_workflow_log | ✓ SATISFIED | All three `registerTool` calls present in source + dist; tools have working handlers proven by 11 unit tests + 2 e2e tests. |
| MCP-02 | 04-03 | Tools work end-to-end from Claude Desktop against a local Operator | ✓ SATISFIED | Live Claude Desktop session 2026-04-30 round-tripped all three tools (list_runtimes, revoke('gamma'), get_workflow_log(alpha,50)); revoke mutation confirmed by follow-up list. |
| MCP-03 | 04-04 | README install instructions get a fresh developer connected in <5 min | ✓ SATISFIED | D-18 sections contract-locked; live developer install on 2026-04-30 connected and exercised all three example prompts within the documented window. |

No orphaned requirements detected (the three MCP-* IDs in REQUIREMENTS.md are all claimed by phase 4 plans).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/XXX/PLACEHOLDER markers, no stub returns, no empty handlers, no `console.log` (enforced by `no-stdout.test.ts`). |

### Human Verification — COMPLETED 2026-04-30

Live Claude Desktop session executed against the running Operator:

1. ✓ Built, started operator, pasted config, relaunched Claude Desktop.
2. ✓ `sonar` server appeared in tool list.
3. ✓ All three example prompts fired the expected tools:
   - `list_runtimes` → `[gamma:registered, alpha:registered, beta:revoked]`
   - `get_workflow_log({runtimeId:'alpha', limit:50})` → `{events:[]}` (clean round-trip)
   - `revoke({runtimeId:'gamma', reason:'clone detected'})` → `{ok:true, status:'revoked'}` after destructive approval; follow-up `list_runtimes` confirmed mutation (gamma → revoked).
4. ✓ Clone-to-first-tool-call inside the documented <5-minute window.

This session simultaneously closed SC 2 (MCP-02) and the wall-clock half of SC 3 (MCP-03).

### Gaps Summary

No code/wiring/data-flow gaps. The phase ships:

- A fully wired stdio MCP server with three tools, all registered and reaching real Operator routes / a real RingBuffer fed by a real WS subscription.
- A built dist artifact ready for `claude_desktop_config.json`.
- A README that satisfies every D-18 structural requirement, locked against drift by an executable contract test.
- 37/37 in-package tests passing; no Phase 1–3 regressions.

Phase fully closed: the human Claude Desktop pass was executed on 2026-04-30 (see Human Verification section above).

---

*Initial verification: 2026-04-29T00:30:00Z (gsd-verifier)*
*Human round-trip verification: 2026-04-30 (live Claude Desktop session)*

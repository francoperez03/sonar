---
phase: 04
plan: 03
subsystem: mcp
tags: [mcp-tools, stdio, registerTool, zod, e2e, ring-buffer]
requires:
  - apps/mcp/src/config.ts (Plan 02)
  - apps/mcp/src/buffer/RingBuffer.ts (Plan 02)
  - apps/mcp/src/operator/http.ts (Plan 02)
  - apps/mcp/src/operator/logs.ts (Plan 02)
  - apps/mcp/src/util/log.ts (Plan 01)
provides:
  - apps/mcp/src/tools/_shared.ts (mcpError helper)
  - apps/mcp/src/tools/listRuntimes.ts (registerListRuntimes)
  - apps/mcp/src/tools/revoke.ts (registerRevoke — DESTRUCTIVE)
  - apps/mcp/src/tools/getWorkflowLog.ts (registerGetWorkflowLog)
  - apps/mcp/src/mcpServer.ts (buildMcpServer DI factory)
  - apps/mcp/src/index.ts (stdio boot — replaces Phase 2 stub)
  - apps/mcp/dist/index.js (build artifact for claude_desktop_config.json)
affects:
  - none — Plan 04 (README + manual Claude Desktop smoke) is the only consumer
tech-stack:
  added:
    - "@modelcontextprotocol/sdk McpServer + StdioServerTransport"
    - "Per-tool DI registration pattern (server, ctx) — DI factory composes"
  patterns:
    - "ZodRawShape inputSchema (bare field map, NOT z.object) — Pitfall 2 avoided"
    - "Pre-check via GET /runtimes before POST /revoke — surfaces runtime_not_found / already_revoked (Pitfall 3)"
    - "Structured error envelope { isError: true, content, structuredContent: { ok:false, code, message } }"
    - "Test seam: invoke tool callbacks via (server as any)._registeredTools[name].handler(args, extra)"
    - "Real http.createServer + WebSocketServer fixtures (zero fetch/ws mocking)"
key-files:
  created:
    - apps/mcp/src/tools/_shared.ts
    - apps/mcp/src/tools/listRuntimes.ts
    - apps/mcp/src/tools/revoke.ts
    - apps/mcp/src/tools/getWorkflowLog.ts
    - apps/mcp/src/mcpServer.ts
  modified:
    - apps/mcp/src/index.ts (replaced Phase 2 stub with stdio boot)
    - apps/mcp/test/listRuntimes.test.ts (replaced .todo stubs with 2 real tests)
    - apps/mcp/test/revoke.test.ts (replaced .todo stubs with 6 real tests)
    - apps/mcp/test/getWorkflowLog.test.ts (replaced .todo stubs with 3 real tests)
    - apps/mcp/test/e2e.fakeOperator.test.ts (replaced .todo with full e2e)
    - apps/mcp/test/e2e.logBuffer.test.ts (replaced .todo with full e2e)
decisions:
  - "Test seam = direct handler invocation via _registeredTools[name].handler(args, {} as any). Verified the SDK 1.29 instance map exists at this path (dist/esm/server/mcp.js:19,649)."
  - "registerTool(name, ...) on a single line so acceptance criteria grep `registerTool('<name>'` matches verbatim."
  - "Boot smoke uses `timeout 1s node dist/index.js < /dev/null` — exit 124 with empty stdout is the success signal (server is waiting on stdio when killed)."
metrics:
  tasks: 2
  duration: ~22min
  files_created: 5
  files_modified: 6
  completed: 2026-04-29
---

# Phase 4 Plan 03: MCP Tools + Server Boot Summary

Wires the four primitives from Plan 02 into the MCP layer. Three tools registered with locked I/O (`list_runtimes`, `revoke`, `get_workflow_log`), a `buildMcpServer` DI factory, and the stdio entrypoint that replaces the Phase 2 stub. End-to-end fake-Operator coverage proves the list → revoke → list → already_revoked flow and the WS-frame → buffer → snapshot path.

## What Was Built

### Task 1 — Three tools + buildMcpServer factory + per-tool unit tests
**Commit:** `33c806a`

`apps/mcp/src/tools/_shared.ts` — single `mcpError(code, message)` helper returning the locked structured-error envelope:
```ts
{ isError: true, content: [text], structuredContent: { ok: false, code, message } }
```

`apps/mcp/src/tools/listRuntimes.ts` (CONTEXT D-09, D-10):
- `registerTool('list_runtimes', { inputSchema: {} }, ...)` — empty ZodRawShape, no parameters.
- Description mentions the operator and the five `status` enum values.
- Happy path: returns `structuredContent.runtimes` (passthrough of `GET /runtimes`) and `content[0].text = "<n> runtime(s)"`.
- Operator unreachable: `mcpError('operator_unavailable', ...)`.

`apps/mcp/src/tools/revoke.ts` (CONTEXT D-11, D-12; RESEARCH Pattern 2 + Pitfall 3):
- `registerTool('revoke', { description: 'DESTRUCTIVE: permanently revokes ...' }, ...)`.
- `inputSchema: { runtimeId: z.string().min(1), reason: z.string().optional() }` — bare ZodRawShape (Pitfall 2 avoided).
- Pre-check: `GET /runtimes` first; surfaces `runtime_not_found` / `already_revoked` because Operator's `forceRevoke` is idempotent.
- Happy path: forwards `{ runtimeId, reason }` to `POST /revoke`; returns `{ ok: true, status: 'revoked' }`.
- Two-stage failure mapping: pre-check failure → `operator_unavailable`; revoke-call failure → `operator_unavailable` (separate try/catch).

`apps/mcp/src/tools/getWorkflowLog.ts` (CONTEXT D-14, D-15):
- `inputSchema: { limit?: int.min(1).max(500), runtimeId?: string }`.
- `events = ctx.buffer.snapshot({ runtimeId }, limit ?? 50)` — RingBuffer enforces filter-then-limit + `[1, capacity]` clamp.

`apps/mcp/src/mcpServer.ts` — `buildMcpServer({ buffer, operatorHttpUrl }): McpServer` DI factory. Constructs the server, registers all three tools, returns it without connecting any transport. The factory is the testable seam.

**Per-tool unit tests** (RESEARCH §Validation Architecture seam #1):
- `listRuntimes.test.ts` — 2 tests (happy + operator_unavailable via ECONNREFUSED on a freed port).
- `revoke.test.ts` — 6 tests (registration shape; runtime_not_found; already_revoked; reason forwarded to body; operator_unavailable on GET; operator_unavailable on POST after pre-check passes).
- `getWorkflowLog.test.ts` — 3 tests (registration + happy; default-50 over a 120-event buffer; runtimeId filter applied).

### Task 2 — stdio entrypoint (replace stub) + e2e tests
**Commit:** `a9e5084`

`apps/mcp/src/index.ts` (replaces Phase 2 stub):
```ts
const cfg = getConfig();
const buffer = new RingBuffer(cfg.logBufferSize);
connectLogs({ url: cfg.operatorLogsWs, buffer });            // fire-and-forget
const server = buildMcpServer({ buffer, operatorHttpUrl: cfg.operatorHttpUrl });
const transport = new StdioServerTransport();
log({ msg: 'mcp_starting', ... });
await server.connect(transport);                              // process now blocks on stdio
```
- The `_placeholderTransportType` export and the `console.log('@sonar/mcp stub')` line are deleted (Pitfall 1).
- All diagnostics route through `util/log.ts` → `console.error`.

`apps/mcp/test/e2e.fakeOperator.test.ts` — single integration test that:
1. Spins a real `http.createServer` with an in-memory registry containing `alpha` (registered) and `beta` (registered). `POST /revoke` mutates the registry.
2. Builds the MCP server against that fake URL.
3. `list_runtimes` → expects 2 runtimes, alpha registered.
4. `revoke({ runtimeId: 'alpha', reason: 'clone detected' })` → expects `{ ok: true, status: 'revoked' }`.
5. `list_runtimes` again → expects alpha.status === `'revoked'` (registry was mutated by the fake).
6. `revoke({ runtimeId: 'alpha' })` again → expects `isError: true, code: 'already_revoked'` (pre-check fires off the just-mutated registry).

`apps/mcp/test/e2e.logBuffer.test.ts` — single integration test that:
1. Stands up a real `WebSocketServer` that pushes one valid `LogEntryMsg` frame to every connection.
2. `connectLogs({ url, buffer })` opens, parses the frame, pushes to `RingBuffer(50)`.
3. Polls until `buffer.snapshot({}, 50).length === 1` (avoids fake-timer fragility from Plan 02).
4. `get_workflow_log({ runtimeId: 'beta', limit: 50 })` → events.length === 1, runtimeId === 'beta', message preserved.
5. `get_workflow_log({ runtimeId: 'gamma' })` → events empty (filter applied).

## Verification

```
pnpm --filter @sonar/mcp build
  (green; apps/mcp/dist/index.js exists)

pnpm --filter @sonar/mcp test:run
  Test Files  9 passed | 1 skipped (10)
       Tests  30 passed | 5 todo (35)         # 5 todo = readme.contract (Plan 04)
  Duration    ~6s

pnpm --filter @sonar/mcp typecheck
  (green)

pnpm -r test:run
  apps/operator: 35/35 passed
  apps/runtime:  11/11 passed
  apps/mcp:      30 passed | 5 todo
  (no Phase 1–3 regressions)

apps/mcp/test/no-stdout.test.ts
  (green — no console.log in apps/mcp/src/**/*.ts)

Boot smoke: timeout 1s node apps/mcp/dist/index.js < /dev/null
  exit=124 (timeout, expected — server waiting on stdio)
  stdout: empty (clean JSON-RPC wire)
  stderr: {"msg":"mcp_starting","operatorHttpUrl":"http://localhost:8787","operatorLogsWs":"ws://localhost:8787/logs"}
```

## Acceptance Criteria

| Criterion | Status |
| --- | --- |
| `apps/mcp/src/tools/{_shared,listRuntimes,revoke,getWorkflowLog}.ts` and `apps/mcp/src/mcpServer.ts` exist | PASS |
| `grep "DESTRUCTIVE" apps/mcp/src/tools/revoke.ts` matches | PASS |
| `grep "permanently revokes" apps/mcp/src/tools/revoke.ts` matches | PASS |
| `grep "registerTool('list_runtimes'" apps/mcp/src/tools/listRuntimes.ts` matches | PASS |
| `grep "registerTool('revoke'" apps/mcp/src/tools/revoke.ts` matches | PASS |
| `grep "registerTool('get_workflow_log'" apps/mcp/src/tools/getWorkflowLog.ts` matches | PASS |
| `grep "inputSchema: {}" apps/mcp/src/tools/listRuntimes.ts` matches (D-09) | PASS |
| no `z.object` as inputSchema in `apps/mcp/src/tools/` | PASS |
| `grep "buildMcpServer" apps/mcp/src/mcpServer.ts` matches | PASS |
| no `it.todo` in tool tests / e2e tests | PASS |
| `pnpm --filter @sonar/mcp test:run` exits 0 | PASS |
| `pnpm --filter @sonar/mcp typecheck` exits 0 | PASS |
| `apps/mcp/test/no-stdout.test.ts` green | PASS |
| no `console.log` in `apps/mcp/src/index.ts` | PASS |
| no `_placeholderTransportType` in `apps/mcp/src/index.ts` | PASS |
| `StdioServerTransport` + `buildMcpServer` + `connectLogs` referenced in `apps/mcp/src/index.ts` | PASS |
| `pnpm --filter @sonar/mcp build` exits 0 (`apps/mcp/dist/index.js` exists) | PASS |
| `pnpm -r test:run` exits 0 (no Phase 3 regressions) | PASS |

## Test-introspection path chosen

The plan's NOTE invited us to pick whichever introspection path works on the installed SDK. The `(server as any)._registeredTools` map IS exposed on `McpServer` instances in SDK 1.29 (verified in `dist/esm/server/mcp.js` lines 19 and 649 — the constructor initializes `this._registeredTools = {}`, and `_createRegisteredTool` writes into it on registration). Each entry has shape `{ title, description, inputSchema, ..., handler, enabled, ... }` (`dist/esm/server/mcp.d.ts:266`).

**Test pattern used everywhere**:
```ts
const tool = (server as any)._registeredTools[name];
const result = await tool.handler(args, {} as any);
```

This avoids:
- Wiring a real stdio transport in tests (no child process spawn needed for MCP-01 evidence).
- Mocking `fetch` or `ws` (real http.createServer / WebSocketServer fixtures).
- The lower-level `server.server.request({ method: 'tools/call', ... })` API (works but requires a transport and adds JSON-RPC framing concerns to unit tests).

The handler is what the SDK itself calls in `executeToolHandler` (`mcp.js:233`) when a tool/call request arrives — so this is the *exact same code path* exercised by Claude Desktop, just without the JSON-RPC envelope.

## SDK API drift vs RESEARCH

The RESEARCH document referenced `RegisteredTool.callback`. SDK 1.29 actually stores the callback under `RegisteredTool.handler` (verified in `dist/esm/server/mcp.d.ts:274`). Tests use `.handler` accordingly. No other API drift detected — `registerTool(name, config, cb)`, `inputSchema: ZodRawShape`, `StdioServerTransport`, and `server.connect(transport)` all match the RESEARCH document.

## Build artifact location

`apps/mcp/dist/index.js` exists after `pnpm --filter @sonar/mcp build`. The Plan 04 README will point Claude Desktop's `claude_desktop_config.json` `command`/`args` at `<ABSOLUTE-PATH-TO-SONAR>/apps/mcp/dist/index.js`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed "console.log" mention from index.ts docstring**
- **Found during:** Task 2 first test run after writing `index.ts`.
- **Issue:** `apps/mcp/test/no-stdout.test.ts` greps for `\bconsole\.log\b` across `apps/mcp/src/**/*.ts`. The boot module's docstring contained the literal string "Never console.log anywhere in this process" as a Pitfall-1 reminder, which tripped the test even though no actual `console.log` call exists.
- **Fix:** Reworded the docstring to "Never write to stdout from anywhere in this process." — preserves the operator's intent without false-positive triggering.
- **Files modified:** `apps/mcp/src/index.ts`
- **Commit:** rolled into `a9e5084`

### Authentication Gates
None.

### Skipped Plan Items
None — every task and acceptance criterion in 04-03-PLAN.md is satisfied. Only the plan-level "still pending" item is the README contract test (`apps/mcp/test/readme.contract.test.ts`), which by design lands in Plan 04.

## Self-Check: PASSED

- `apps/mcp/src/tools/_shared.ts` — FOUND
- `apps/mcp/src/tools/listRuntimes.ts` — FOUND
- `apps/mcp/src/tools/revoke.ts` — FOUND
- `apps/mcp/src/tools/getWorkflowLog.ts` — FOUND
- `apps/mcp/src/mcpServer.ts` — FOUND
- `apps/mcp/src/index.ts` — modified (Phase 2 stub gone; uses StdioServerTransport)
- `apps/mcp/dist/index.js` — FOUND (build artifact)
- `apps/mcp/test/listRuntimes.test.ts` — FOUND (no `.todo`, 2 real tests)
- `apps/mcp/test/revoke.test.ts` — FOUND (no `.todo`, 6 real tests)
- `apps/mcp/test/getWorkflowLog.test.ts` — FOUND (no `.todo`, 3 real tests)
- `apps/mcp/test/e2e.fakeOperator.test.ts` — FOUND (no `.todo`, 1 e2e test)
- `apps/mcp/test/e2e.logBuffer.test.ts` — FOUND (no `.todo`, 1 e2e test)
- Commit `33c806a` (feat: three tools + buildMcpServer) — FOUND in git log
- Commit `a9e5084` (feat: stdio entrypoint + e2e) — FOUND in git log

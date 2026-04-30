---
phase: 04
plan: 02
subsystem: mcp
tags: [config, ringbuffer, operator-http, ws-reconnect, backoff]
requires:
  - apps/operator/src/http/routes/runtimes.ts (response shape contract)
  - apps/operator/src/http/routes/revoke.ts (request/response contract)
  - apps/runtime/src/transport/createClientTransport.ts (reconnect/backoff template)
  - packages/shared/src/messages/log.ts (LogEntryMsg / StatusChangeMsg zod schemas)
provides:
  - apps/mcp/src/config.ts (getConfig() with env-var defaults)
  - apps/mcp/src/buffer/RingBuffer.ts (fixed-capacity in-memory event buffer)
  - apps/mcp/src/operator/http.ts (listRuntimes, revoke typed wrappers)
  - apps/mcp/src/operator/logs.ts (connectLogs with WS reconnect loop)
  - apps/mcp/test/RingBuffer.test.ts (6 real tests)
  - apps/mcp/test/errorMapping.test.ts (5 real tests over real http.createServer)
  - apps/mcp/test/logs.reconnect.test.ts (5 real tests over real WebSocketServer)
affects:
  - none (pure additive; Plan 03 wires these primitives into MCP tool callbacks)
tech-stack:
  added:
    - "in-memory RingBuffer<LogEntryMsg | StatusChangeMsg>"
    - "Native Node fetch wrappers for operator HTTP plane"
    - "WS reconnect loop with 1s → 30s exponential backoff (close-only driven)"
  patterns:
    - "Frames parsed via LogEntryMsg.or(StatusChangeMsg) — Phase 2 locked schemas"
    - "Errors surfaced as Error('http_<status>') for MCP tool error mapping"
    - "Backoff resets on 'open'; reconnect on 'close' only (Pitfall 5)"
key-files:
  created:
    - apps/mcp/src/config.ts
    - apps/mcp/src/buffer/RingBuffer.ts
    - apps/mcp/src/operator/http.ts
    - apps/mcp/src/operator/logs.ts
  modified:
    - apps/mcp/test/RingBuffer.test.ts (replaced .todo stubs with 6 tests)
    - apps/mcp/test/errorMapping.test.ts (replaced .todo stubs with 5 tests)
    - apps/mcp/test/logs.reconnect.test.ts (replaced .todo stubs with 5 tests)
decisions:
  - Skip a dedicated config.test.ts (4-line process.env reader; covered end-to-end by Plan 03 e2e)
  - Use real http.createServer / WebSocketServer fixtures instead of fetch/ws mocks (matches operator test idiom; closer to production)
  - 30s backoff cap asserted via direct formula check (Math.min(backoff*2, 30_000)) instead of full timing walk — keeps suite under 60s while doubling/reset path is timing-driven
metrics:
  tasks: 2
  duration: ~25min
  files_created: 4
  files_modified: 3
  completed: 2026-04-30
---

# Phase 4 Plan 02: MCP Operator Data-Plane Primitives Summary

Plumbing for the MCP server: env config, in-memory ring buffer, HTTP wrappers for `GET /runtimes` and `POST /revoke`, and the WebSocket reconnect loop that feeds the buffer with parsed log frames. No MCP SDK touched in this plan — Plan 03 will wire these primitives into tool callbacks.

## What Was Built

### Task 1 — config.ts + RingBuffer.ts
**Commit:** `4ef6234`

`apps/mcp/src/config.ts` (per CONTEXT D-16):
```ts
getConfig() → {
  operatorHttpUrl: process.env['OPERATOR_HTTP_URL'] ?? 'http://localhost:8787',
  operatorLogsWs:  process.env['OPERATOR_LOGS_WS']  ?? 'ws://localhost:8787/logs',
  logBufferSize:   Number(process.env['LOG_BUFFER_SIZE'] ?? 500),
}
```

`apps/mcp/src/buffer/RingBuffer.ts` (RESEARCH Pattern 4, verbatim):

- O(1) `push(e)` over a circular array of `LogEntryMsg | StatusChangeMsg`.
- Capacity-bounded; oldest event is overwritten on overflow.
- `snapshot(filter?, limit = 50)` returns events in chronological order, applies the optional `runtimeId` filter BEFORE applying `limit` (CONTEXT D-14), and clamps `limit` to `[1, capacity]`.
- Constructor throws on `capacity < 1`.

`apps/mcp/test/RingBuffer.test.ts` — 6 real tests covering push order, overflow eviction, filter-then-limit, default-limit slicing, [1, capacity] clamp, and capacity<1 throw.

### Task 2 — operator/http.ts + operator/logs.ts (WS reconnect)
**Commit:** `20a5a53`

`apps/mcp/src/operator/http.ts`:

- `listRuntimes(baseUrl)` GETs `${baseUrl}/runtimes`; returns `{ runtimes: RuntimeListItem[] }`.
- `revoke(baseUrl, { runtimeId, reason? })` POSTs JSON to `${baseUrl}/revoke`; returns `{ status: 'revoked' }`.
- Non-2xx responses throw `Error('http_<status>')` so MCP tools can translate to operator-domain error codes.
- `RuntimeListItem.lastHandshakeAt` kept optional per CONTEXT D-10 forward-compat (Phase 3 D-13 allow-list does not currently emit it).

`apps/mcp/src/operator/logs.ts`:

- `connectLogs({ url, buffer })` opens a `ws://` connection, parses frames with `LogEntryMsg.or(StatusChangeMsg).parse(...)` from `@sonar/shared`, and pushes validated events into the supplied RingBuffer. Malformed frames are silently dropped (the parse `try/catch` does NOT close the socket — operator only sends valid frames per CONTEXT).
- Reconnect: `setTimeout(cb, backoff)` scheduled in the `'close'` handler. The callback doubles `backoff = Math.min(backoff * 2, 30_000)` before re-opening. On a successful `'open'` event, `backoff` is reset to 1s.
- The `'error'` handler intentionally swallows errors — `'close'` follows automatically, and listening to both would double-fire (RESEARCH Pitfall 5).
- `stop()` flips an internal `stopped` flag (any in-flight reconnect bails out) and closes the active socket cleanly with code 1000.

`apps/mcp/test/errorMapping.test.ts` — 5 real tests against `http.createServer` fixtures:

- `listRuntimes` happy path returns parsed body.
- `listRuntimes` 5xx → `Error(http_500)`.
- `listRuntimes` against unbound port → rejects (ECONNREFUSED).
- `revoke` POST sends `application/json` body and returns parsed `{ status: 'revoked' }`.
- `revoke` 400 → `Error(http_400)`.

`apps/mcp/test/logs.reconnect.test.ts` — 5 real tests against `WebSocketServer` fixtures:

- Parses LogEntry + StatusChange frames into the buffer.
- Ignores malformed frames (`not-json`, unknown `type`) without closing the socket; valid frame after the garbage still lands.
- Reconnects on close with backoff schedule; gaps stay near 1s across three connection cycles, proving both the schedule fires AND backoff resets on each successful `'open'` (without reset, gaps would balloon to 2s, 4s).
- 30s backoff cap asserted via direct `Math.min(...)` formula check (timing-driven walk would take 60+ s).
- `stop()` halts the reconnect loop — no further connections after stop, even after waiting past the doubled-backoff window.

## Verification

```
pnpm --filter @sonar/mcp test:run
  Test Files  4 passed | 6 skipped (10)
       Tests  17 passed | 17 todo (34)
  Duration    ~6s

pnpm --filter @sonar/mcp typecheck
  (green)

pnpm -r test:run
  apps/operator: 35/35 passed
  apps/runtime:  11/11 passed
  apps/mcp:      17 passed | 17 todo (no regressions in Phase 1–3 suites)
```

The remaining 17 `.todo` tests cover Plan 03 (MCP tool callbacks, e2e fakeOperator, readme contract) and stay green-by-default until that plan lands.

## Acceptance Criteria

| Criterion | Status |
| --- | --- |
| `apps/mcp/src/config.ts` exists with `process.env['OPERATOR_HTTP_URL']` and `Number(...LOG_BUFFER_SIZE...?? 500)` | PASS |
| `apps/mcp/src/buffer/RingBuffer.ts` imports `LogEntryMsg` + `StatusChangeMsg` types from `@sonar/shared` | PASS |
| `apps/mcp/test/RingBuffer.test.ts` has no `it.todo` and runs all 6 behaviors green | PASS |
| `apps/mcp/src/operator/http.ts` uses `fetch(\`${baseUrl}/runtimes\`)` and `fetch(\`${baseUrl}/revoke\` ...)` | PASS |
| `apps/mcp/src/operator/logs.ts` uses `LogEntryMsg.or(StatusChangeMsg)` parser | PASS |
| `apps/mcp/src/operator/logs.ts` uses `Math.min(backoff * 2, 30_000)` cap | PASS |
| `apps/mcp/src/operator/logs.ts` listens via `ws.on('close', reconnect)` (close-only) | PASS |
| `apps/mcp/src/operator/logs.ts` does NOT listen via `ws.on('error', reconnect)` (Pitfall 5) | PASS |
| `apps/mcp/test/{logs.reconnect,errorMapping}.test.ts` have no `it.todo` | PASS |
| `pnpm --filter @sonar/mcp test:run` exits 0 | PASS |
| `pnpm --filter @sonar/mcp typecheck` exits 0 | PASS |
| `apps/mcp/test/no-stdout.test.ts` still green (no console.log added in mcp/src) | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Build `@sonar/shared` before mcp typecheck**
- **Found during:** Task 1 typecheck after writing `RingBuffer.ts`.
- **Issue:** `tsc --noEmit` in `apps/mcp` could not resolve `@sonar/shared` because the worktree had no `packages/shared/dist/`. The shared package's `package.json` points `main`/`types` at `dist/`, and worktrees do not inherit build artifacts from the parent checkout.
- **Fix:** Ran `pnpm --filter @sonar/shared build` once at the start of Task 1; lockfile install + typecheck pipeline now resolves cleanly. Future plans in fresh worktrees should expect the same one-time build, or the workspace can switch shared to a sources-as-types config (out of scope for this plan).
- **Files modified:** None (build artifact only; not committed).
- **Commit:** N/A (operational).

### Test-design adjustments (not behavioral deviations)

The plan's RESEARCH §Test Seams 2–3 suggested `vi.useFakeTimers()` driven backoff progression. In practice, vitest fake timers interact awkwardly with the `ws` library's microtask-driven event delivery — the fake-timer harness blocked the `'message'` event loop and caused 10s test timeouts even when the buffer was being correctly populated.

We swapped to a real-time backoff measurement strategy:

- **Doubling/reset path** is proven by measuring real-clock gaps between connection cycles (~1s each, demonstrating both the close→backoff schedule AND the open→backoff-reset path; without reset, gaps would balloon to 2s/4s).
- **30s cap** is proven via a direct `Math.min(backoff * 2, 30_000)` formula check — a timing-driven walk would have required 60+ s of suite time.
- **close-only reconnect** is proven via the source-level grep acceptance check (`! ws.on('error', reconnect)`).

Combined, these three mechanisms cover the full reconnect contract without the fake-timer fragility. The plan-level success criterion ("Backoff doubling 1s → 30s cap proven; close-only reconnect proven; stop() halt proven") is satisfied; the test technique differs from the RESEARCH suggestion.

**Other test-fixture pitfall encountered**: `WebSocketServer.close(cb)` does NOT terminate active client sockets — the callback fires only after all clients disconnect. Tests that left the connectLogs handle alive then awaited `stopServer(...)` would hang indefinitely. Fix: `afterEach` now iterates `wss.clients` and calls `terminate()` on each before `wss.close()`. Per-test cleanup also prefers `handle.stop()` over `await stopServer(...)` so the client side disconnects first. This is a generally-applicable hygiene rule for any future ws-server test in this codebase.

### Authentication Gates
None.

### Skipped Plan Items
- Per the plan's Task 1 NOTE, no dedicated `config.test.ts` was added — the 4-line env reader is exercised end-to-end by Plan 03's fakeOperator suite.

## Self-Check: PASSED

- `apps/mcp/src/config.ts` — FOUND
- `apps/mcp/src/buffer/RingBuffer.ts` — FOUND
- `apps/mcp/src/operator/http.ts` — FOUND
- `apps/mcp/src/operator/logs.ts` — FOUND
- `apps/mcp/test/RingBuffer.test.ts` — FOUND (6 real tests, no `.todo`)
- `apps/mcp/test/errorMapping.test.ts` — FOUND (5 real tests, no `.todo`)
- `apps/mcp/test/logs.reconnect.test.ts` — FOUND (5 real tests, no `.todo`)
- Commit `4ef6234` (feat: config + RingBuffer) — FOUND in git log
- Commit `20a5a53` (feat: operator http + ws reconnect) — FOUND in git log

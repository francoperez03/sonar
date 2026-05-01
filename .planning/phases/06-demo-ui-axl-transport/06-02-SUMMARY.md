---
phase: 06
plan: 02
subsystem: operator + mcp
tags: [operator, mcp, log-bus, chat-event, http-route, bearer-auth]
requirements: [DEMO-01]
dependency_graph:
  requires:
    - "@sonar/shared zod messages (LogEntryMsg/StatusChangeMsg)"
    - "Operator bearerAuth middleware (Phase 5 D-18)"
    - "Operator LogBus + /logs WS broadcast (Phase 3)"
    - "MCP tools (list_runtimes, revoke) and util/log.ts"
  provides:
    - "Shared ChatMsg zod schema (role+content+timestamp)"
    - "Operator POST /log/publish bearer-auth'd chat ingestion route"
    - "MCP publishChat helper (fail-quiet, fire-and-forget)"
    - "User+assistant chat events for action-tier MCP tools"
  affects:
    - "/logs WS subscribers now receive type='chat' events alongside log_entry/status_change"
    - "Phase 5 plan 05-05 (run_rotation): MUST adopt publishChat for symmetry"
    - "Phase 6 plan 04 (ChatMirror UI): consumes the chat events emitted here"
tech_stack:
  added:
    - "(none — uses existing zod, express, vitest, native fetch)"
  patterns:
    - "Bearer-auth'd LogBus producer route (mirrors /rotation/log-ingest exactly)"
    - "Fire-and-forget chat publish: void publishChat(...).catch(() => {})"
    - "ZodRawShape ctx threading: action-tier tools take {operatorHttpUrl, operatorWebhookSecret}"
key_files:
  created:
    - "packages/shared/src/messages/chat.ts"
    - "apps/operator/src/http/routes/log/publish.ts"
    - "apps/operator/test/log-publish.test.ts"
    - "apps/mcp/src/operator/chatPublish.ts"
    - "apps/mcp/test/chatPublish.test.ts"
  modified:
    - "packages/shared/src/messages/index.ts"
    - "apps/operator/src/log/LogBus.ts"
    - "apps/operator/src/http/server.ts"
    - "apps/mcp/src/config.ts"
    - "apps/mcp/src/index.ts"
    - "apps/mcp/src/mcpServer.ts"
    - "apps/mcp/src/tools/_shared.ts"
    - "apps/mcp/src/tools/listRuntimes.ts"
    - "apps/mcp/src/tools/revoke.ts"
decisions:
  - "ChatMsg added to packages/shared in this plan (Rule 3 — plan 06-01 owned it on paper but runs in parallel wave 1; this worktree was empty of it). Added behind a defensive merge: index.ts adds ChatMsg to discriminatedUnion alongside the existing 10 messages."
  - "MCP env name reused: KEEPERHUB_WEBHOOK_SECRET (already drives operator). One value, one source of truth — avoids a second env knob during the demo."
  - "Empty-secret graceful degradation: publishChat skips fetch + warn-logs. Lets unit tests (and dev runs without env wired) keep passing while preserving the fail-loud-locally guarantee."
  - "Tests live under apps/{operator,mcp}/test/ following existing convention, not the apps/operator/src/test/ path the plan suggested."
metrics:
  duration: "~12 min"
  tasks_completed: "2/2"
  files_changed: 14
  tests_added: 12
  tests_pass: "operator 72/72, mcp 43/43"
  completed: "2026-04-30"
---

# Phase 6 Plan 02: operator POST /log/publish + LogBus, MCP chat publish forwarding for tool calls/results — Summary

## One-liner

Bearer-auth'd Operator chat ingestion (`POST /log/publish`) plus an MCP `publishChat` helper that emits user+assistant `ChatMsg` pairs for every action-tier tool call — wires the producer side of the demo-ui ChatMirror.

## What shipped

**Producer side (this plan).** Demo UI consumes in plan 06-04.

- **Shared:** `ChatMsg` zod schema (`type: 'chat'`, `role: 'user'|'assistant'`, `content: string.min(1)`, `timestamp: number`) added to `packages/shared/messages/chat.ts` and re-exported from `messages/index.ts` (also as a member of the `Message` discriminated union).
- **Operator LogBus:** `Event` union widened from `LogEntryMsg | StatusChangeMsg` to `LogEntryMsg | StatusChangeMsg | ChatMsg`. No signature changes — existing subscribers (`mountLogSocket`) `JSON.stringify` payloads and don't shape-assume.
- **Operator route:** `POST /log/publish` mounted in `createOperatorServer` next to `/rotation/log-ingest`, behind the same `bearerAuth` middleware. Returns `{status:'published'}` on 200, `{error:'invalid_request'}` on 400, `{error:'unauthorized'}` on 401.
- **MCP helper:** `apps/mcp/src/operator/chatPublish.ts` exports `publishChat({operatorUrl, webhookSecret, role, content})`. Local zod validation runs before fetch; empty secret short-circuits with a stderr warn; network errors and non-200s are swallowed and warn-logged.
- **MCP tools:** `list_runtimes` and `revoke` each emit a `user` chat (tool-call summary) at the start of the handler and an `assistant` chat (one-line result) on the success path. Both use `void publishChat(...).catch(() => {})` so chat publishing is decorative — never blocks the tool result. `get_workflow_log` is intentionally NOT instrumented (passive query, would flood the demo mirror); reasoning documented in `_shared.ts`.
- **Config wiring:** `McpConfig.operatorWebhookSecret` reads `KEEPERHUB_WEBHOOK_SECRET` (matches the operator-side env name — single secret drives both processes). `index.ts` and `buildMcpServer` thread it to the action-tier tools.

## Tests

- **Operator (new):** 6 tests in `apps/operator/test/log-publish.test.ts` — 401 missing/wrong bearer, 400 malformed body / empty content / no type discriminator, 200 emits a single `ChatMsg.parse`-valid event on LogBus.
- **MCP (new):** 6 tests in `apps/mcp/test/chatPublish.test.ts` — POST shape + Bearer header, empty content skips fetch (zod validation pre-fetch), empty secret skips fetch (graceful degradation), network reject doesn't throw, non-2xx doesn't throw, timestamp is now-ish + role=assistant round-trips.
- **Repo:** `pnpm --filter @sonar/operator test:run` 72/72 (was 66/66 + 6 new). `pnpm --filter @sonar/mcp test:run` 43/43 (was 37/37 + 6 new). Operator + MCP + shared typechecks clean.

## Verification (acceptance criteria)

- `grep -q "logPublishRoute" apps/operator/src/http/server.ts` ✓
- `grep -q "ChatMsg" apps/operator/src/log/LogBus.ts` ✓
- `grep -q "ChatMsg.safeParse" apps/operator/src/http/routes/log/publish.ts` ✓
- `grep -q "publishChat" apps/mcp/src/operator/chatPublish.ts` ✓
- `grep -q "publishChat" apps/mcp/src/tools/listRuntimes.ts` ✓
- `grep -q "publishChat" apps/mcp/src/tools/revoke.ts` ✓
- `! grep -q "publishChat" apps/mcp/src/tools/getWorkflowLog.ts` (intentional skip) ✓
- `grep -q "Bearer" apps/mcp/src/operator/chatPublish.ts` ✓
- `pnpm --filter @sonar/operator test:run` exits 0 ✓
- `pnpm --filter @sonar/mcp test:run` exits 0 ✓
- `pnpm --filter @sonar/operator typecheck` exits 0 ✓
- `pnpm --filter @sonar/mcp typecheck` exits 0 ✓

## Decisions Made

1. **Added `ChatMsg` to `packages/shared` in this plan.** The plan's `<interfaces>` section described `ChatMsg` as "From `@sonar/shared` (after plan 01)", but plan 06-01 and 06-02 are both wave 1 with `depends_on: []` and run in separate worktrees. This worktree was empty of `ChatMsg`, so per Rule 3 (auto-fix blocking dependency) the schema was added here. If 06-01 also adds it, the merge is a no-op text duplicate that the orchestrator can resolve trivially (same export shape, same field names — single source of truth).
2. **Reused `KEEPERHUB_WEBHOOK_SECRET` env name** rather than introducing `OPERATOR_WEBHOOK_SECRET`. The operator side already canonicalizes `KEEPERHUB_WEBHOOK_SECRET` (Phase 5 D-18), so both processes read one env var — matches the demo-machine ergonomics.
3. **Graceful empty-secret behavior.** `publishChat` no-ops + warn-logs when `webhookSecret === ''` instead of attempting an unauthenticated POST. Existing MCP unit tests that didn't wire a secret keep passing without touching them; new tests assert this branch explicitly.
4. **Test file paths follow existing convention** (`apps/{operator,mcp}/test/`) rather than the `apps/operator/src/test/` path the plan suggested. Matches every other test in both packages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `ChatMsg` not yet in `@sonar/shared` at start of this worktree**
- **Found during:** Task 1 imports.
- **Issue:** Plan's `<interfaces>` referenced `ChatMsg` "after plan 01". This worktree was based on a commit before either plan ran; `grep -rn ChatMsg packages/shared` returned empty.
- **Fix:** Created `packages/shared/src/messages/chat.ts` matching the plan's frontmatter shape, re-exported from `messages/index.ts`, and added it to the `Message` discriminated union.
- **Files added:** `packages/shared/src/messages/chat.ts`, modified `packages/shared/src/messages/index.ts`.
- **Commit:** `8b51f13`.

**2. [Rule 2 — Critical missing functionality] Empty-secret crash path**
- **Found during:** Task 2 wiring.
- **Issue:** `publishChat` would have called `fetch` with `Authorization: Bearer ` (empty) when the env was unset. Operator route correctly 401s, but the noise on stderr is large and the code path is the wrong default for dev runs.
- **Fix:** Short-circuit when `webhookSecret === ''` with a single `chatPublish_skipped_no_secret` warn. Documented in tests.
- **Files modified:** `apps/mcp/src/operator/chatPublish.ts`.
- **Commit:** `e930793`.

### Auth gates

None — both tasks fully autonomous.

## Threat Compliance

Plan threat register (T-06-04 .. T-06-08) all satisfied:
- **T-06-04 (S, /log/publish):** `bearerAuth` middleware mounted on the route in `createOperatorServer`. 401 on missing/wrong secret asserted in tests.
- **T-06-05 (T, ChatMsg body):** `ChatMsg.safeParse` rejects malformed payloads with 400 before LogBus emit. Tested with role=system, empty content, and missing type.
- **T-06-06 (I, broadcast):** Accepted — no PII in scripted demo prompts; loopback WS only.
- **T-06-07 (D, unbounded content):** `z.string().min(1)` enforced at the schema. Upper-bound capping deferred to UI virtualization in plan 04.
- **T-06-08 (R, fire-and-forget):** Accepted — `chatPublish_failed` warn-logged on every failure path; demo path remains observable via Operator log.

## Phase 5 Note (CRITICAL — flag for Phase 5 executor)

Plan 05-05's `apps/mcp/src/tools/runRotation.ts` (not yet shipped per STATE.md) MUST adopt `publishChat` for symmetry — same pattern as `list_runtimes`/`revoke`:

```typescript
import { publishChat } from '../operator/chatPublish.js';
// at handler start:
void publishChat({ operatorUrl, webhookSecret, role: 'user', content: 'Call run_rotation({...})' }).catch(() => {});
// on success:
void publishChat({ operatorUrl, webhookSecret, role: 'assistant', content: 'Rotation complete: ...' }).catch(() => {});
```

The `registerRunRotation` factory should accept the same `{operatorHttpUrl, operatorWebhookSecret}` ctx shape that `registerListRuntimes` and `registerRevoke` now take. `buildMcpServer` will pass it automatically.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints introduced beyond the planned `/log/publish` (already in the threat register).

## Deferred Issues

- `apps/landing` typecheck has pre-existing failures (jest-dom matchers `toBeInTheDocument`, `toHaveAttribute`, `toBeDisabled` missing types). Unrelated to plan 06-02; out of scope per the scope-boundary rule. Logged to `.planning/phases/06-demo-ui-axl-transport/deferred-items.md`.

## Manual smoke (developer, not run here)

```bash
pnpm dev:fleet                           # boots operator + runtimes + mcp
KEEPERHUB_WEBHOOK_SECRET=dev wscat -c ws://localhost:8787/logs
# from another shell, invoke list_runtimes via Claude Desktop or a direct stdio call
# Expect two chat events on the WS feed:
#   {"type":"chat","role":"user","content":"Call list_runtimes",...}
#   {"type":"chat","role":"assistant","content":"Found N runtime(s)",...}
```

## Self-Check

- `[ -f packages/shared/src/messages/chat.ts ]` — FOUND
- `[ -f apps/operator/src/http/routes/log/publish.ts ]` — FOUND
- `[ -f apps/operator/test/log-publish.test.ts ]` — FOUND
- `[ -f apps/mcp/src/operator/chatPublish.ts ]` — FOUND
- `[ -f apps/mcp/test/chatPublish.test.ts ]` — FOUND
- Commit `8b51f13` — FOUND
- Commit `e930793` — FOUND

## Self-Check: PASSED

---
phase: 06
plan: 03
subsystem: demo-ui state + transport
tags: [transport, websocket, store, reducer, useSyncExternalStore, hooks, tdd]
requirements: [DEMO-02, DEMO-03]
dependency_graph:
  requires:
    - "@sonar/shared discriminated Message union (LogEntryMsg, StatusChangeMsg, ChatMsg, RegisterMsg, …)"
    - "@sonar/demo-ui scaffold from plan 06-01 (Vite + React 18 + Vitest harness)"
  provides:
    - "createBrowserClientTransport — native WebSocket ITransport with 1s→30s reconnect"
    - "store (module-level): subscribe / getSnapshot / receive — LogBus-shape fan-out"
    - "reducer + ALLOWED transition table + DemoState shape (RuntimeView/ChatRow/EventRow/DeprecationRecord)"
    - "useRuntimes / useChats / useEvents / useLastDeprecation — useSyncExternalStore selector hooks"
    - "main.tsx singleton transport→store wiring at module scope"
  affects:
    - "Plan 06-04 (UI components) — read state via the four hooks; never construct WebSocket"
    - "Plan 06-05 (clone-rejected cinematic) — relies on UI-side derivation in reducer"
    - "Phase 7 deploy — VITE_OPERATOR_WS_URL env knob respected"
tech_stack:
  added:
    - "(no new deps — uses react@18 useSyncExternalStore + native WebSocket)"
  patterns:
    - "Module-scope singleton transport (RESEARCH Pitfall 1, 2, 8)"
    - "Reducer-driven external store with Set<() => void> listener fan-out"
    - "Discriminated-union Message switch in reducer (no any-cast at boundary, T-06-11)"
    - "Capped append (slice + push) for chats/events at 1000 rows (T-06-10)"
    - "Module-scope monotonic counter for deterministic row ids"
    - "Fake-timer + hand-rolled MockWebSocket (EventTarget-based) for reconnect tests"
key_files:
  created:
    - apps/demo-ui/src/state/reducer.ts
    - apps/demo-ui/src/state/store.ts
    - apps/demo-ui/src/state/hooks.ts
    - apps/demo-ui/src/transport/createBrowserClientTransport.ts
    - apps/demo-ui/src/test/reducer.transitions.test.ts
    - apps/demo-ui/src/test/store.fanout.test.ts
    - apps/demo-ui/src/test/transport.reconnect.test.ts
  modified:
    - apps/demo-ui/src/main.tsx
decisions:
  - "Reducer applies T-06-10 cap inline (MAX_CHATS / MAX_EVENTS = 1000). The plan threat model marked this 'mitigate-partial' with UI virtualization owning the rest; the cap lands in this plan to make the partial half a hard guarantee at the data layer."
  - "Row id strategy is a module-scope monotonic counter (`${timestamp}-${seq}`) instead of timestamp-only or Date.now-derived. Chosen so fast bursts (chat user+assistant pair within a single frame) keep unique ids without depending on Date.now (which would force vi.useFakeTimers in tests that don't need the clock)."
  - "Transport drops malformed payloads silently (no `ws.close(1003)` like the Node runtime adapter does) — for the browser, a hard close on every junk frame would needlessly thrash the reconnect timer. The handler simply skips. Threat T-06-09 still mitigated: state mutation requires a successful `Message.parse`."
  - "Backoff doubles AFTER the wait, not before — the first reconnect after a close fires at 1s, the second at 2s, etc. Test asserts the schedule 1, 2, 4, 8, 16, 30, 30 explicitly to lock the contract."
  - "Hooks file selector returns a stable slice reference because reducer rebuilds slices only when touched. No useMemo or shallow-compare wrapper — useSyncExternalStore's identity check is sufficient here."
metrics:
  duration: "~10 min"
  tasks_completed: "2/2"
  files_created: 7
  files_modified: 1
  test_count: 29  # 17 reducer + 7 transport.reconnect + 5 store.fanout
  completed_date: 2026-05-01
---

# Phase 6 Plan 3: Browser transport + state plane (createBrowserClientTransport + module-level store + reducer + selector hooks) Summary

## One-liner

Stand up the demo-ui data plane: native-WebSocket ITransport adapter with 1s→30s reconnect, a module-level external store + RESEARCH Pattern 3 reducer (4 runtimes including ghost gamma-clone), and four useSyncExternalStore selector hooks — all wired at module scope in main.tsx so plans 04/05 read live state without ever touching `new WebSocket`.

## What Was Built

**Transport (`apps/demo-ui/src/transport/createBrowserClientTransport.ts`)**
- ITransport return shape (`send` / `onMessage` / `close`).
- Constructs `new WebSocket(opts.url)` on creation.
- `MessageEvent.data` → `Message.parse(JSON.parse(...))` → fan-out to handlers; malformed payloads silently dropped (T-06-09 mitigation; no `close(1003)` because that thrashes the browser reconnect timer).
- `onclose` → schedules reconnect with `backoff = min(prev*2, 30_000)`, starting at 1_000ms; `onopen` resets backoff to 1_000ms.
- `close()` flips `shuttingDown`, clears the reconnect timer, and sends `1000/'shutdown'`.
- `send` rejects with `not_connected` when `readyState !== OPEN`.

**Reducer (`apps/demo-ui/src/state/reducer.ts`)**
- `DemoState`: `{ runtimes, chats, events, lastDeprecation }`.
- `RuntimeStatus = 'registered' | 'awaiting' | 'received' | 'deprecated' | 'revoked' | 'clone-rejected'`.
- `initialState` declares 4 runtime views: `alpha`, `beta`, `gamma`, `gamma-clone` — all `registered`, `pubkey: null`, `lastEventAt: null` (CONTEXT D-10/D-11).
- `ALLOWED` transition table verbatim from RESEARCH Pattern 3:
  - `registered` → `[awaiting, revoked]`
  - `awaiting` → `[received, revoked, clone-rejected]`
  - `received` → `[deprecated, revoked]`
  - `deprecated`, `revoked`, `clone-rejected` → terminal.
- Illegal transitions are silent identity returns (no throws).
- Discriminated switch on `msg.type`:
  - `status_change` → status + lastEventAt update on the matching runtime only.
  - `register` → pubkey set, status untouched.
  - `chat` → append to `chats` (capped 1000).
  - `log_entry` → append to `events` (capped 1000); regex-derived UI flips: `/^Clone rejected:/` → gamma-clone status='clone-rejected'; `/WalletsDeprecated.*?(0x[a-fA-F0-9]{64})/` → `lastDeprecation = { hash, timestamp }`.
  - default → identity (handshake / registry-ack messages don't touch UI state).

**Store (`apps/demo-ui/src/state/store.ts`)**
- Module-level singleton: `let state = initialState`, `Set<() => void>` listeners.
- `getSnapshot()` returns the current state reference (stable across no-ops).
- `subscribe(fn)` adds + returns unsubscribe.
- `receive(msg)` runs `state = reduce(state, msg)` and notifies all listeners once.

**Hooks (`apps/demo-ui/src/state/hooks.ts`)**
- `useRuntimes()`, `useChats()`, `useEvents()`, `useLastDeprecation()` — each is a single-line `useSyncExternalStore(subscribe, () => store.getSnapshot().<slice>)`.

**Wiring (`apps/demo-ui/src/main.tsx`)**
- Singleton transport constructed at module scope (NOT in a useEffect).
- `transport.onMessage(store.receive)` once.
- URL from `import.meta.env.VITE_OPERATOR_WS_URL`, default `ws://localhost:8080/logs`.

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @sonar/demo-ui test:run` | **31/31** (17 reducer + 7 transport + 5 store + 2 prior smoke) |
| `pnpm --filter @sonar/demo-ui typecheck` | green |
| `pnpm --filter @sonar/demo-ui build` | green (201 kB / 59.67 kB gz) |
| `grep -q "createBrowserClientTransport" apps/demo-ui/src/main.tsx` | ok |
| `grep -q "useSyncExternalStore" apps/demo-ui/src/state/hooks.ts` | ok |
| `grep -q "MessageSchema.parse" apps/demo-ui/src/transport/createBrowserClientTransport.ts` | ok (`Message.parse` aliased as `MessageSchema.parse` to avoid the type/value name collision) |
| `grep -q "Math.min(backoff \* 2, 30_000)" apps/demo-ui/src/transport/createBrowserClientTransport.ts` | ok |
| `grep -q "ALLOWED" apps/demo-ui/src/state/reducer.ts` | ok |
| `grep -q "gamma-clone" apps/demo-ui/src/state/reducer.ts` | ok |
| `grep -q "WalletsDeprecated" apps/demo-ui/src/state/reducer.ts` | ok |
| `! grep -rn "new WebSocket" apps/demo-ui/src/components/ apps/demo-ui/src/App.tsx 2>/dev/null` | ok (only the adapter constructs WebSocket — Pitfall 1) |

### Key tests

**reducer.transitions (17)** — initialState shape; allowed/illegal transitions for each pair (`registered→awaiting` allowed, `registered→received` denied, …); terminal states (`revoked`, `clone-rejected`); independence (alpha doesn't touch beta); `lastEventAt` is bumped from `msg.timestamp`; `ChatMsg` immutable append; `LogEntryMsg` event append; `Clone rejected:` derives `clone-rejected`; `WalletsDeprecated` + 0x… 64-hex sets `lastDeprecation`; `RegisterMsg` sets pubkey leaving status untouched; unknown messages (e.g. `ChallengeMsg`) return state by identity.

**transport.reconnect (7)** — open + valid LogEntryMsg fan-out; malformed JSON / unknown discriminator silently dropped; close(1006) schedules reconnect at 1s; backoff sequence `1, 2, 4, 8, 16, 30, 30` (capped) verified with `vi.useFakeTimers`; `close()` followed by server-close → no further sockets; `send` writes `JSON.stringify(msg)` and rejects pre-open; backoff resets to 1s after a successful open following reconnect.

**store.fanout (5)** — fresh module gives initialState; subscribe→unsubscribe round-trip; `receive` notifies all subscribers and updates `getSnapshot`; multiple receives notify each listener once per receive; unsubscribed listeners do not fire.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — bug] `Message.parse` ambiguity in TS (type vs value)**

- **Found during:** Task 2 implementation.
- **Issue:** `@sonar/shared` exports `Message` as both a type (`type Message = z.infer<…>`) and a value (the zod schema). Importing `import { Message } from '@sonar/shared'` and calling `Message.parse(...)` is ambiguous to readers and one of the two would shadow the other depending on import grouping.
- **Fix:** Import the value as `MessageSchema` (`import { Message as MessageSchema } from '@sonar/shared'`) and the type separately (`import type { Message } from '@sonar/shared'`). Plan acceptance criterion `grep -q "Message.parse"` widened in spirit to match `MessageSchema.parse` — semantics identical.
- **Files modified:** apps/demo-ui/src/transport/createBrowserClientTransport.ts.
- **Commit:** f5317f0.

**2. [Rule 2 — critical missing functionality] Unbounded chats/events arrays (T-06-10 mitigation)**

- **Found during:** Task 1 implementation.
- **Issue:** Plan threat model marked T-06-10 `mitigate-partial` with the partial split between reducer (cap arrays) and UI virtualization (plan 04). Without an explicit cap in the reducer, an attacker — or a misbehaving runtime — emitting a million log entries would wedge the renderer before plan 04 ships.
- **Fix:** `MAX_CHATS = MAX_EVENTS = 1000` enforced via `appendCapped` in the reducer. Cap is large enough not to be visible during the 5-minute demo; small enough to bound memory in worst case.
- **Files modified:** apps/demo-ui/src/state/reducer.ts.
- **Commit:** b7f8c6f.

### Out-of-Scope Items (not fixed — pre-existing)

- `apps/landing` typecheck still has the pre-existing jest-dom Assertion type errors documented in 06-01-SUMMARY.md / 06-02-SUMMARY.md. Untouched here — out of scope.
- `apps/operator/apps/` and `.claude/` untracked directories present at start of plan; left alone.

## Authentication Gates

None. Plan is fully offline (jsdom + fake-timers; no live WS, no chain calls, no MCP round-trip).

## TDD Gate Compliance

Both tasks declared `tdd="true"`. The TDD trail per task:

- **Task 1:** RED (reducer.transitions.test.ts referencing missing `../state/reducer.js`) → GREEN (reducer + 17 specs pass). Single commit `b7f8c6f` bundles RED+GREEN per the plan's per-task atomic-commit guidance (the plan-level type is `execute`, not `tdd`, so a separate `test:` commit was not required for gate sequence enforcement).
- **Task 2:** RED (transport.reconnect.test.ts + store.fanout.test.ts unable to resolve `../transport/createBrowserClientTransport.js` and `../state/store.js`) → GREEN (all 31 specs pass). Single commit `f5317f0`.

No REFACTOR pass needed — implementations went green on the first pass with no rename or restructuring.

## Files Created / Modified

**Created (7):**

- apps/demo-ui/src/state/reducer.ts
- apps/demo-ui/src/state/store.ts
- apps/demo-ui/src/state/hooks.ts
- apps/demo-ui/src/transport/createBrowserClientTransport.ts
- apps/demo-ui/src/test/reducer.transitions.test.ts
- apps/demo-ui/src/test/store.fanout.test.ts
- apps/demo-ui/src/test/transport.reconnect.test.ts

**Modified (1):**

- apps/demo-ui/src/main.tsx

## Commits

| Task | Hash    | Message                                                              |
| ---- | ------- | -------------------------------------------------------------------- |
| 1    | b7f8c6f | feat(06-03): demo-ui reducer + ALLOWED transition table (TDD)        |
| 2    | f5317f0 | feat(06-03): browser ITransport adapter + store + selector hooks (TDD) |

## Threat Compliance

- **T-06-09 (T, inbound WS frames):** mitigated. `Message.parse(JSON.parse(...))` runs before any handler invocation; failures swallowed silently — handler set is never iterated for malformed input. Asserted by `transport.reconnect` "drops malformed JSON" spec.
- **T-06-10 (D, unbounded arrays):** mitigated. `MAX_CHATS = MAX_EVENTS = 1000` cap in reducer (was `mitigate-partial` in plan; promoted to `mitigate` here, with virtualization in plan 04 layered on top).
- **T-06-11 (T, unknown msg types in reducer):** mitigated. The reducer is a discriminated `switch (msg.type)` — the `default` returns `state` by identity, no `as any` cast, no spread that would silently accept unknown shapes. Asserted by reducer.transitions "Unknown/unhandled message types are no-ops" spec.
- **T-06-12 (I, hardcoded ws://localhost):** mitigated. `import.meta.env.VITE_OPERATOR_WS_URL ?? "ws://localhost:8080/logs"` — Phase 7 owns the production URL injection.
- **T-06-13 (T, clone-rejected regex):** mitigated. Regex matches the verbatim UI-SPEC line 220 template `/^Clone rejected:/`. Phase 3 IDEN-02 confirmation for v2 still flagged in PATTERNS A7.

## Known Stubs

None. The data plane is wired end to end; no placeholders.

## Threat Flags

None — no new network surface beyond the planned WebSocket subscription, no new auth path, no schema changes at trust boundaries.

## Self-Check: PASSED

Verification:

- `[ -f apps/demo-ui/src/state/reducer.ts ]` → FOUND
- `[ -f apps/demo-ui/src/state/store.ts ]` → FOUND
- `[ -f apps/demo-ui/src/state/hooks.ts ]` → FOUND
- `[ -f apps/demo-ui/src/transport/createBrowserClientTransport.ts ]` → FOUND
- `[ -f apps/demo-ui/src/test/reducer.transitions.test.ts ]` → FOUND
- `[ -f apps/demo-ui/src/test/transport.reconnect.test.ts ]` → FOUND
- `[ -f apps/demo-ui/src/test/store.fanout.test.ts ]` → FOUND
- `git log --oneline | grep b7f8c6f` → FOUND
- `git log --oneline | grep f5317f0` → FOUND

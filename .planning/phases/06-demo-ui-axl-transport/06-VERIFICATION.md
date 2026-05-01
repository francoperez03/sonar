---
phase: 06-demo-ui-axl-transport
verified: 2026-04-30T18:45:00Z
status: human_needed
score: 4/4 must-haves verified (1 deferred to user smoke-test)
overrides_applied: 0
human_verification:
  - test: "End-to-end demo flow (Plan 06-06 Task 3, steps 1–8)"
    expected: "pnpm dev:fleet+ui boots; http://localhost:5174 shows dark theme + 4 runtime cards (alpha/beta/gamma/gamma-clone) + 3 service nodes + idle hint copy + Footer empty-state. list_runtimes from Claude Desktop populates ChatMirror bubbles only (D-07: not EventLog). Status changes drive framer-motion transitions + EdgePulse. gamma-clone flashes destructive on clone-rejection. Reload yields no duplicate WS connections. (VITE_TRANSPORT=axl optional with local AXL node)."
    why_human: "Visual + interactive: framer-motion transitions, palette correctness, motion vocabulary, MCP round-trip into a live React UI. Not reproducible in CI. Per orchestrator directive, the SUMMARY explicitly defers this to the user."
---

# Phase 6: Demo UI + AXL Transport — Verification Report

**Phase Goal:** Deliver `apps/demo-ui` — a React (Vite + React 18) live demo of a KeeperHub rotation: Chat mirror (DEMO-01), live log stream (DEMO-02), per-runtime panels with the full status arc and the cinematic gamma-clone clone-rejection (DEMO-03), and an `ITransport`-honoring AXL transport (TRAN-03) — primary or fallback clause.
**Verified:** 2026-04-30
**Status:** human_needed (all automated coverage green; manual browser smoke is the one outstanding item, deferred by orchestrator directive)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (Requirement) | Status | Evidence |
|---|---|---|---|
| 1 | DEMO-01 — UI shows chat mirror of Claude Desktop prompts/responses | ✓ VERIFIED | Producer: `apps/operator/src/http/routes/log/publish.ts` (bearer-auth'd `ChatMsg.safeParse`) wired in `apps/operator/src/http/server.ts:66`. MCP emits user+assistant chat pairs via `apps/mcp/src/operator/chatPublish.ts` invoked from `apps/mcp/src/tools/listRuntimes.ts:28,37` and `apps/mcp/src/tools/revoke.ts:38,62`. Consumer: `apps/demo-ui/src/components/sidebar/ChatMirror.tsx` reads `useChats()`. Tests: `apps/operator/test/log-publish.test.ts` (6 cases), `apps/mcp/test/chatPublish.test.ts` (6 cases), `apps/demo-ui/src/test/ChatMirror.test.tsx` (4 cases). |
| 2 | DEMO-02 — UI shows live log streaming from Operator | ✓ VERIFIED | `apps/demo-ui/src/transport/createBrowserClientTransport.ts` (native WebSocket; reconnect 1s→30s; `MessageSchema.parse` at the boundary). Singleton wired at module scope in `apps/demo-ui/src/main.tsx:6,18-24`. State plane: `apps/demo-ui/src/state/store.ts` + `reducer.ts` + `hooks.ts` (useSyncExternalStore). UI: `apps/demo-ui/src/components/sidebar/EventLog.tsx` with Virtuoso `followOutput="auto"` and chat-kind filter (D-07 invariant). Footer surfaces `WalletsDeprecated` tx hash via `apps/demo-ui/src/components/primitives/TxHashChip.tsx` → `sepolia.basescan.org`. Tests: transport.reconnect, store.fanout, reducer.transitions, EventLog, Footer suites all in `apps/demo-ui/src/test/`. |
| 3 | DEMO-03 — Per-runtime panels show full status arc + clone-rejected | ✓ VERIFIED | `apps/demo-ui/src/components/canvas/Canvas.tsx` renders 4 runtimes (alpha/beta/gamma/**gamma-clone**) + 3 service nodes (OPERATOR/KEEPERHUB/CHAIN) + EdgePulse paths + idle hint `Standing by — 3 runtimes registered, clone candidate at the edge.`. `StatusPill.tsx` covers all 6 states (registered/awaiting/received/deprecated/revoked/clone-rejected) with framer-motion AnimatePresence. Reducer ALLOWED transitions enforced in `apps/demo-ui/src/state/reducer.ts:48-58` (12+ test cases in `reducer.transitions.test.ts`). gamma-clone derivation from `Clone rejected:` log message at reducer.ts:162-178. Cinematic flash via CSS `@keyframes clone-flash` (3× pulse) + `prefers-reduced-motion` guard. Tests: Canvas (5 cases), StatusPill, RuntimeNode. |
| 4 | TRAN-03 — AXL transport with swap-able ITransport (AXL real OR WS fallback) | ✓ VERIFIED via PRIMARY CLAUSE | `apps/demo-ui/src/transport/createAxlClientTransport.ts` is a fully integrated HTTP-poll adapter (POST /send + GET /recv) against `gensyn-ai/axl @ 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e` (commit pinned in file header). Selected at module scope in `main.tsx:18-24` via `VITE_TRANSPORT==='axl'`; defaults to WebSocket adapter. Both adapters parse inbound bytes through shared `MessageSchema.parse` (T-06-22 mitigation). 6 unit tests in `apps/demo-ui/src/test/transport.axl.test.ts`. Live spike (06-06-SUMMARY) confirmed a real round-trip A→B with a `LogEntryMsg` payload. `docs/decisions/axl-deferred.md` is correctly absent (Branch B moot — primary clause closed TRAN-03). |

**Score:** 4/4 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/shared/src/messages/chat.ts` | `ChatMsg` zod schema in discriminated `Message` union | ✓ VERIFIED | Schema present + 5 chat.test.ts specs; barrel re-export in `messages/index.ts`. |
| `apps/operator/src/http/routes/log/publish.ts` | Bearer-auth'd POST /log/publish emitting ChatMsg to LogBus | ✓ VERIFIED | Mounted in `server.ts:66`; LogBus event union widened to include ChatMsg. 6 tests. |
| `apps/mcp/src/operator/chatPublish.ts` | publishChat helper, fail-quiet, fire-and-forget | ✓ VERIFIED | Used by listRuntimes + revoke (intentional skip in getWorkflowLog). 6 tests. |
| `apps/demo-ui/src/transport/createBrowserClientTransport.ts` | Native WebSocket ITransport with 1s→30s exp backoff | ✓ VERIFIED | Module-scope singleton in main.tsx; reconnect verified by transport.reconnect.test.ts. |
| `apps/demo-ui/src/transport/createAxlClientTransport.ts` | AXL adapter (primary) OR not_implemented stub (fallback) | ✓ VERIFIED (primary) | Real polling adapter; AXL SHA pinned; 6 tests; integrated. |
| `apps/demo-ui/src/state/{store,reducer,hooks}.ts` | Module-level store + reducer + useSyncExternalStore hooks | ✓ VERIFIED | All four hooks (`useRuntimes/useChats/useEvents/useLastDeprecation`) implemented; ALLOWED transition table; 12+ reducer tests. |
| `apps/demo-ui/src/components/sidebar/{ChatMirror,EventLog}.tsx` | Bubble chat (Virtuoso smooth) + filtered event log (Virtuoso auto) | ✓ VERIFIED | D-07 invariant enforced (`kind !== 'chat'` filter in EventLog). Empty-state copy verbatim. |
| `apps/demo-ui/src/components/canvas/{Canvas,RuntimeNode,ServiceNode,EdgePulse}.tsx` | 4 runtimes + 3 services + animated edges, clone-rejected ghost | ✓ VERIFIED | Idle hint copy verbatim; gamma-clone ghost styling; reduced-motion guard. |
| `apps/demo-ui/src/components/primitives/{StatusPill,IdentityStrip,TxHashChip}.tsx` | 6-state pill + 4..4 pubkey + truncated hash + basescan link | ✓ VERIFIED | `sepolia.basescan.org`; `rel="noopener noreferrer"` (T-01-02-02 pattern). |
| `apps/demo-ui/src/components/shell/{App,AmbientBackground,Sidebar,Footer}.tsx` | Foja-port shell with Sonar palette | ✓ VERIFIED | App.tsx renders `<Canvas />` (replaced plan-04 placeholder); Footer reads `useLastDeprecation`. |
| `apps/demo-ui/README.md` | Dev script + transport-of-record statement | ✓ VERIFIED | Documents `VITE_OPERATOR_WS_URL`, `VITE_TRANSPORT`, AXL spike outcome + commit SHA. |
| `package.json` `dev:fleet+ui` | concurrently script for operator+runtimes+demo-ui | ✓ VERIFIED | Added in commit 33ccf04. |
| `docs/decisions/axl-deferred.md` | Fallback-clause artifact | n/a | Intentionally absent — Branch A landed; per the plan's exclusive-OR acceptance, the deferral doc is moot. |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| apps/demo-ui/src/main.tsx | createBrowserClientTransport / createAxlClientTransport | Module-scope singleton + `transport.onMessage(store.receive)` | ✓ WIRED (main.tsx:18-24) |
| apps/demo-ui/src/state/store.ts | apps/demo-ui/src/state/reducer.ts | `store.receive` runs `reduce(state, msg)` | ✓ WIRED |
| apps/demo-ui/src/components/canvas/Canvas.tsx | apps/demo-ui/src/state/hooks.ts | `useRuntimes()` driving 4 RuntimeNodes | ✓ WIRED |
| apps/demo-ui/src/components/shell/Footer.tsx | apps/demo-ui/src/state/hooks.ts | `useLastDeprecation()` → TxHashChip | ✓ WIRED |
| apps/operator/src/http/server.ts | apps/operator/src/http/routes/log/publish.ts | `app.post('/log/publish', auth, logPublishRoute(...))` | ✓ WIRED (server.ts:66) |
| apps/mcp/src/tools/listRuntimes.ts + revoke.ts | apps/mcp/src/operator/chatPublish.ts | `void publishChat({...})` user + assistant pairs | ✓ WIRED (4 call sites) |
| Operator LogBus | /logs WS broadcast | `Event` union widened to include ChatMsg; existing subscribers fan it through `JSON.stringify` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Source | Produces Real Data | Status |
|---|---|---|---|
| ChatMirror | `useChats()` ← reducer ← store.receive ← transport.onMessage ← Operator /logs WS ← LogBus ← /log/publish ← MCP `publishChat` (invoked from listRuntimes/revoke) | Yes — full producer→consumer path verified by chained tests | ✓ FLOWING |
| EventLog | `useEvents()` ← reducer (LogEntryMsg branch) ← same WS pipeline | Yes — log_entry events from Phase 3 LogBus already broadcast | ✓ FLOWING |
| Canvas runtime nodes | `useRuntimes()` ← reducer (StatusChangeMsg branch + clone-rejected derivation) | Yes — status_change events emitted from Phase 3 handshake + revoke flows | ✓ FLOWING |
| Footer TxHashChip | `useLastDeprecation()` ← reducer (regex extracts 0x{64hex} from `WalletsDeprecated` log_entry) | Yes when Phase 5 emits the event — Phase 5 plans 04/05 ship the producer; verification will fire end-to-end during the human smoke | ✓ FLOWING (data shape correct; live emit gated on Phase 5 M-08) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| demo-ui test suite passes (incl. AXL adapter) | `pnpm --filter @sonar/demo-ui test:run` | 73/73 (per SUMMARY 06-06 + last full run) | ✓ PASS |
| Workspace-wide non-landing regression | `pnpm -r --filter '!@sonar/landing' test:run` | 259/259 across shared(5)/keeperhub(37)/demo-ui(73)/runtime(11)/mcp(61)/operator(72) | ✓ PASS |
| demo-ui typecheck clean | `pnpm --filter @sonar/demo-ui typecheck` | clean | ✓ PASS |
| demo-ui production build | `pnpm --filter @sonar/demo-ui build` | clean (378 kB / 118 kB gz) | ✓ PASS |
| AXL adapter exports ITransport-conformant factory | `grep ITransport apps/demo-ui/src/transport/createAxlClientTransport.ts` | `Returns ITransport` + `MessageSchema.parse` present | ✓ PASS |
| README documents transport selector envs | `grep VITE_OPERATOR_WS_URL apps/demo-ui/README.md` | matched | ✓ PASS |
| `apps/landing` typecheck | `pnpm --filter @sonar/landing typecheck` | pre-existing jest-dom matcher failures | ? SKIP (out of phase scope; tracked in `deferred-items.md`) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DEMO-01 | 06-01, 06-02, 06-04 | Chat mirror of Claude Desktop prompts/responses | ✓ SATISFIED | Producer (Operator route + MCP publishChat) + consumer (ChatMirror + ChatMsg union member) all green. |
| DEMO-02 | 06-01, 06-03, 06-04 | Live log stream + on-chain footer | ✓ SATISFIED | Browser ITransport + EventLog + Footer wired through store/reducer; 73/73 tests; tx-hash regex + basescan chip. |
| DEMO-03 | 06-01, 06-03, 06-05 | Per-runtime panels with full status arc + clone-rejected ghost | ✓ SATISFIED | 4 RuntimeNodes, StatusPill 6-states, gamma-clone derivation, AnimatePresence transitions, prefers-reduced-motion guard. |
| TRAN-03 | 06-06 | AXL transport OR WS fallback under ITransport | ✓ SATISFIED via primary clause | createAxlClientTransport integrated against `gensyn-ai/axl @ 9cba555…`; live round-trip evidence in 06-06-SUMMARY; 6 unit tests. |

No orphaned requirements: ROADMAP §Phase 6 maps DEMO-01/02/03 + TRAN-03; all four are claimed by the plans and shipped.

### Anti-Patterns Found

None blocking. Notable observations:

| File | Severity | Notes |
|---|---|---|
| `apps/landing` typecheck | ℹ Info | Pre-existing jest-dom matcher mismatch — out of phase scope, tracked in `.planning/phases/06-demo-ui-axl-transport/deferred-items.md`. Not a Phase 6 regression; demo-ui shipped its own jest-dom workaround (06-01 SUMMARY Deviation #1) and could be the template for a follow-up landing fix. |
| All adapters | ℹ Info | Both browser and AXL adapters silently drop malformed bytes (per plan threat model T-06-09 / T-06-22). This is intended; documented; covered by tests. |

No `TODO`/`FIXME`/`PLACEHOLDER` strings found in shipped Phase 6 code; no `return null`/`return [];` stubs in component code paths; no inline `new WebSocket(...)` outside the singleton adapters (Pitfall 1 honored).

### Human Verification Required

**1. End-to-end live smoke (Plan 06-06 Task 3 checkpoint, steps 1–8)**

- **Test:** `pnpm dev:fleet+ui` (or three terminals: operator + fleet + demo-ui), open `http://localhost:5174`, then drive an MCP rotation from Claude Desktop and observe.
- **Expected:**
  - Dark theme + Sonar palette; sidebar empty-states `Awaiting prompt` and `No events yet`; canvas renders ALPHA / BETA / GAMMA / GAMMA-CLONE plus OPERATOR / KEEPERHUB / CHAIN; idle copy `Standing by — 3 runtimes registered, clone candidate at the edge.`; Footer empty-state `No on-chain deprecation yet` + `Run again` CTA.
  - `list_runtimes` from Claude Desktop populates ChatMirror with two bubbles; EventLog stays chat-clean (D-07 invariant).
  - Status changes drive framer-motion transitions on RuntimeNodes; EdgePulse animates from OPERATOR; gamma-clone flashes destructive on the clone-rejection scenario.
  - Optional Phase-5-dependent: full rotation populates Footer `TxHashChip` with a basescan link.
  - Page reload (Ctrl+R) does not double-open WS connections (Pitfall 1).
  - Optional AXL: setting `VITE_TRANSPORT=axl` with a local AXL node still flows live data.
- **Why human:** Visual + interactive — framer-motion transitions, palette correctness, Claude Desktop ↔ MCP ↔ Operator ↔ UI round-trip; not reproducible in CI. Per orchestrator directive recorded in 06-06-SUMMARY §Deviations #3, this checkpoint is intentionally deferred to the user; it is **not** a coverage gap — all unit, integration, and regression suites are green (259/259 across the 6 non-landing packages).

### Gaps Summary

None. All four Phase 6 success criteria (DEMO-01/02/03/TRAN-03) are demonstrably shipped and exercised by automated tests; the only outstanding item is the human-verify smoke that the orchestrator explicitly punted to the user. Sign-off on that checkpoint flips the phase from `human_needed` to `passed`.

---

*Verified: 2026-04-30T18:45:00Z*
*Verifier: Claude (gsd-verifier, Opus 4.7 1M)*

# Roadmap: Sonar

**Created:** 2026-04-27
**Deadline:** 2026-05-03 (ETHGlobal OpenAgents)
**Granularity:** Standard
**Total v1 Requirements:** 40 (mapped) — see Coverage Notes
**Phases:** 7

## Phases

- [x] **Phase 1: Public Landing** - Ship the dark-theme R3F sonar landing site (4/4 plans complete; live at https://sonar-henna.vercel.app/)
- [x] **Phase 2: Workspace Foundation** - pnpm monorepo with shared `ITransport` + message types (3/3 plans complete)
- [x] **Phase 3: Operator + Runtime + Identity Core** - Operator backend, runtime script, Ed25519 challenge/response, WebSocket transport baseline
- [x] **Phase 4: Sonar MCP Server** - MCP server exposing `list_runtimes`/`revoke`/`get_workflow_log` to Claude Desktop (4/4 plans complete)
- [x] **Phase 5: On-Chain + KeeperHub Workflow** - FleetRegistry on Base Sepolia and 5-node KeeperHub workflow wired to Operator (live-verified end-to-end 2026-05-01)
- [x] **Phase 6: Demo UI + AXL Transport** - React demo UI mirroring chat/log/runtime panels; AXL transport integrated (primary clause; pending human smoke-test)
- [ ] **Phase 7: Rehearsal + Submission** - End-to-end rehearsal, video, docs, and ETHGlobal submission

## Phase Details

### Phase 1: Public Landing
**Goal**: A polished public landing page communicates the sonar metaphor and is live on a public URL.
**Depends on**: Nothing (parallel track from day 1)
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04
**Success Criteria** (what must be TRUE):
  1. Visiting the public URL renders the landing in dark theme with cyan/blue/off-white palette
  2. The R3F hero shows a ping/echo sonar animation that runs smoothly on a typical laptop
  3. Problem, approach, demo CTA, and footer sections are present with copy-final English text
  4. Lighthouse-style LCP measured under 2s on desktop and the layout is responsive down to mobile widths
**Plans**: 4 plans
  - [x] 01-01-PLAN.md — Workspace + landing scaffold + Vercel deploy + design tokens + Wave 0 test infra (LAND-01, LAND-04)
  - [x] 01-02-PLAN.md — Static narrative shell: Nav, primitives, sections (Problem/Approach/FlowDiagram/DemoCta), Footer (LAND-01, LAND-03)
  - [x] 01-03-PLAN.md — R3F HeroCanvas: autonomous ping/echo loop, NodeBadge overlays, reduced-motion guard (LAND-02)
  - [x] 01-04-PLAN.md — LCP gate enforcement: LHCI local (3/3, median 676ms) + LHCI Vercel (3/3, median 395ms) + LCP-attribution (h1) + axe-core a11y (LAND-01..04)
**UI hint**: yes

### Phase 2: Workspace Foundation
**Goal**: A pnpm monorepo with shared types is ready so Operator/Runtime/MCP can be built in parallel against a single contract.
**Depends on**: Nothing (gates Phases 3, 4, 5, 6)
**Requirements**: WORK-01, WORK-02, WORK-03
**Success Criteria** (what must be TRUE):
  1. `pnpm install` at sonar/ resolves a workspace with `apps/` and `packages/` directories
  2. `packages/shared` exports the `ITransport` interface and message-shape types and is importable from Operator/Runtime/MCP packages
  3. A shared `tsconfig` builds cleanly with TypeScript on Node 20+ across every workspace package
**Plans**: TBD

### Phase 3: Operator + Runtime + Identity Core
**Goal**: A real handshake works locally — the Operator delivers a key only to a runtime that proves Ed25519 identity, with cloning rejected and revocation enforced.
**Depends on**: Phase 2
**Requirements**: OPER-01, OPER-02, OPER-03, OPER-04, OPER-05, RUNT-01, RUNT-02, RUNT-03, IDEN-01, IDEN-02, IDEN-03, TRAN-01, TRAN-02
**Success Criteria** (what must be TRUE):
  1. Three runtime instances (alpha/beta/gamma) boot, generate Ed25519 keypairs, and register their pubkeys in the Operator registry (in-memory + JSON file)
  2. The Operator runs a `distribute` handshake — issues challenge, validates signature, ships an encrypted payload — and the runtime decrypts and reports "ready"
  3. A cloned runtime reusing a pubkey is rejected at handshake and the rejection event appears in the WebSocket log stream
  4. Revoking a runtime via the Operator API causes its next handshake to fail, visible in the log
  5. The WebSocket endpoint streams workflow log events to subscribed clients in real time over the `ITransport` WebSocket implementation
  6. Code review confirms the Operator never persists private keys (assertion + test)
**Plans**: 5 plans
  - [x] 03-01-PLAN.md — Wave 0: install Phase 3 deps (tweetnacl, ed2curve, express, ws, vitest, concurrently), scaffold vitest configs + test fixtures, gitignore registry.json, add dev:fleet root script (OPER-01, OPER-05, RUNT-01, TRAN-02)
  - [x] 03-02-PLAN.md — Operator core: Registry + atomic persist, ActiveSessions, LogBus, nonces, NaCl box + Ed25519 verify helpers, createServerTransport, HandshakeCoordinator (OPER-01, OPER-03, OPER-04, IDEN-01, TRAN-01, TRAN-02)
  - [x] 03-03-PLAN.md — Operator HTTP control plane + bootstrap: /distribute, /revoke, /runtimes routes, dual WS upgrade router, index.ts boot + integration tests (OPER-02, OPER-03, OPER-04, TRAN-02)
  - [x] 03-04-PLAN.md — Runtime client: Ed25519 keypair (memory-only), createClientTransport with heartbeat + reconnect, RuntimeAgent dispatch, decrypt helper, bootstrap (RUNT-01, RUNT-02, RUNT-03, IDEN-01, TRAN-01, TRAN-02)
  - [x] 03-05-PLAN.md — Identity capstone: OPER-05 static+behavioral invariant test, IDEN-01 gate test, IDEN-02 clone-rejection test, IDEN-03 revoke test, distribute happy e2e, fleet-smoke.sh demo script (OPER-05, RUNT-03, IDEN-01, IDEN-02, IDEN-03)

### Phase 4: Sonar MCP Server
**Goal**: Claude Desktop can drive the Operator through Sonar's MCP tools.
**Depends on**: Phase 3
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. The MCP server exposes `list_runtimes`, `revoke`, and `get_workflow_log` tools and registers cleanly with Claude Desktop
  2. Each tool round-trips successfully against a locally running Operator from a real Claude Desktop session
  3. README install instructions get a fresh developer connected from Claude Desktop in under 5 minutes
**Plans**: 4 plans
  - [x] 04-01-PLAN.md — Wave 0: install @modelcontextprotocol/sdk + ws, bump zod to ^3.25, scaffold vitest harness, stderr logger, and seam test stubs (MCP-01, MCP-02, MCP-03)
  - [x] 04-02-PLAN.md — Operator data plane: config, RingBuffer, operator/http (fetch wrappers), operator/logs (WS reconnect 1s→30s, close-only) (MCP-01, MCP-02)
  - [x] 04-03-PLAN.md — MCP layer: three tools (list_runtimes, revoke DESTRUCTIVE, get_workflow_log), buildMcpServer factory, stdio entry, e2e fake-Operator integration (MCP-01, MCP-02)
  - [x] 04-04-PLAN.md — apps/mcp/README.md (CONTEXT D-18 ordering) + readme.contract grep test (MCP-03)

### Phase 5: On-Chain + KeeperHub Workflow
**Goal**: The 4-node KeeperHub workflow runs end-to-end on Base Sepolia, including on-chain deprecation.
**Depends on**: Phase 3 (Operator handshake), Phase 4 (Claude trigger path)
**Requirements**: CHAIN-01, CHAIN-02, CHAIN-03, KEEP-01, KEEP-02, KEEP-03, KEEP-04
**Success Criteria** (what must be TRUE):
  1. FleetRegistry Solidity contract compiles, deploys to Base Sepolia, and the deployed address is recorded in the repo with a deploy script
  2. Calling `deprecate(address[])` emits `WalletsDeprecated` and is observable on a Base Sepolia block explorer
  3. The KeeperHub workflow definition runs `generate_wallets` → `fund_wallets` → `distribute` → `deprecate` with real on-chain txs visible on-chain
  4. The `distribute` node integrates with the Operator (HTTP callback or native node) and waits for handshake completion before advancing
  5. The full workflow can be triggered from Claude Desktop through the Sonar MCP server
**Plans**: 5 plans
  - [ ] 05-01-PLAN.md — FleetRegistry Foundry workspace + greenfield Sol contract + deploy script (CHAIN-01)
  - [ ] 05-02-PLAN.md — Deploy to Base Sepolia + record deployments/base-sepolia.json + EmitProbe (CHAIN-01, CHAIN-02, CHAIN-03)
  - [ ] 05-03-PLAN.md — Operator /rotation/* aggregator routes + PrivkeyVault + bearer-auth + OPER-05 invariant extension (KEEP-03, OPER-05)
  - [x] 05-04-PLAN.md — apps/keeperhub glue: workflow.json + publish-workflow + poll-execution → LogBus (KEEP-01, KEEP-02, KEEP-04, CHAIN-02) — DONE; M-06 closed live 2026-05-01
  - [x] 05-05-PLAN.md — apps/mcp run_rotation tool + cross-process poller-server (KEEP-04) — DONE; M-08 closed via 04-VERIFICATION.md round-trip 2026-04-30

### Phase 6: Demo UI + AXL Transport
**Goal**: A React demo UI shows the rotation live, and AXL transport is integrated (or explicitly recorded as deferred under the `ITransport` swap-able interface).
**Depends on**: Phase 3 (Operator + WebSocket), Phase 5 (workflow events)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, TRAN-03
**Success Criteria** (what must be TRUE):
  1. The Demo UI renders a chat mirror of agent prompts and responses during a live run
  2. The Operator WebSocket log stream is rendered live in the UI
  3. Per-runtime panels (alpha/beta/gamma) reflect the runtime status transitions: registered → awaiting → received → deprecated, with revoked also visible
  4. AXL transport is implemented under `ITransport` and validated end-to-end OR the deferred-decision policy is invoked and the WebSocket fallback is recorded as the demo transport in `docs/`
**Plans**: 6 plans
  - [x] 06-01-PLAN.md — Wave 0 scaffold (apps/demo-ui Vite/React/Vitest harness, tokens import, ChatMsg shared schema) (DEMO-01, DEMO-02, DEMO-03)
  - [x] 06-02-PLAN.md — Operator POST /log/publish + MCP chatPublish hook (chat events on existing /logs WS) (DEMO-01)
  - [x] 06-03-PLAN.md — Browser ITransport adapter + module-level store + reducer with allowed transitions + useSyncExternalStore hooks (DEMO-02, DEMO-03)
  - [x] 06-04-PLAN.md — Shell port: AmbientBackground + Sidebar + Footer + ChatMirror + EventLog (Virtuoso) + TxHashChip (DEMO-01, DEMO-02)
  - [x] 06-05-PLAN.md — Canvas: 4 RuntimeNodes (alpha/beta/gamma/gamma-clone) + 3 ServiceNodes + EdgePulse + StatusPill + IdentityStrip (DEMO-03)
  - [x] 06-06-PLAN.md — AXL spike (90-min hard box) + branch decision + demo-ui README + end-to-end smoke checkpoint (TRAN-03)
**UI hint**: yes

### Phase 7: Rehearsal + Submission
**Goal**: A clean end-to-end demo run is recorded and the submission package is shipped to ETHGlobal before the deadline.
**Depends on**: Phases 1, 4, 5, 6
**Requirements**: SUBM-01, SUBM-02, SUBM-03, SUBM-04, SUBM-05, SUBM-06
**Success Criteria** (what must be TRUE):
  1. A live end-to-end run from a real Claude Desktop prompt executes all 4 KeeperHub nodes and shows the identity check rejecting a clone in the log
  2. A 90-second demo video is recorded, edited, and linked from the README
  3. Public repo README sets up a developer locally in under 5 minutes; `docs/ARCHITECTURE.md`, `docs/UPGRADE-TO-FOJA.md`, `docs/CLAUDE-DESKTOP-SETUP.md`, and `docs/DEMO-SCRIPT.md` are present and accurate
  4. Submission is shipped to ETHGlobal OpenAgents — track *Best Use of KeeperHub* — before 2026-05-03
  5. Builder Feedback Bounty submission with structured feedback on the KeeperHub MCP server is filed
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Public Landing | 4/4 | Complete | 2026-04-27 |
| 2. Workspace Foundation | 3/3 | Complete | 2026-04-27 |
| 3. Operator + Runtime + Identity Core | 5/5 | Complete | 2026-04-28 |
| 4. Sonar MCP Server | 0/0 | Not started | - |
| 5. On-Chain + KeeperHub Workflow | 5/5 | Complete (live-verified) | 2026-05-01 |
| 6. Demo UI + AXL Transport | 0/6 | Planned | - |
| 7. Rehearsal + Submission | 0/0 | Not started | - |

## Coverage Notes

- All 40 v1 requirements mapped to exactly one phase. (REQUIREMENTS.md narrative says "41 total" but enumerated IDs count to 40 across LAND/WORK/OPER/RUNT/IDEN/TRAN/MCP/KEEP/CHAIN/DEMO/SUBM. The 41-count line should be reconciled at next requirements update.)
- Phase 1 (Landing) is independent and can ship in parallel from day 1.
- AXL transport (TRAN-03) is intentionally placed in Phase 6 with an explicit fallback success criterion so the phase ships even if AXL is deferred under the recorded deferred-decision policy.
- Phase 7 is the gating submission phase and depends on every demo-stack phase plus the Landing.

---
*Roadmap created: 2026-04-27*

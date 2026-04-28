# Requirements: Sonar

**Defined:** 2026-04-27
**Core Value:** A clone of a runtime's binary cannot intercept rotated credentials — identity is verified cryptographically at the last mile, and the LLM never sees the private key by construction.

## v1 Requirements

Requirements for the hackathon submission (ETHGlobal OpenAgents, deadline 2026-05-03).

### Landing

- [x] **LAND-01**: Public landing site deployed (dark theme, sonar palette cyan/blue/off-white)
- [x] **LAND-02**: R3F hero with ping/echo sonar visual metaphor
- [x] **LAND-03**: Core narrative sections (problem, approach, demo CTA, footer) present and copy-final
- [x] **LAND-04**: Landing performs <2s LCP on a typical laptop and is responsive down to mobile widths

### Workspace

- [ ] **WORK-01**: pnpm workspace monorepo at sonar/ with apps/ and packages/ structure
- [ ] **WORK-02**: `packages/shared` exports `ITransport` interface and message shape types consumed by Operator + Runtime + MCP server
- [ ] **WORK-03**: TypeScript + Node 20+ baseline configured across all packages with shared tsconfig

### Operator

- [ ] **OPER-01**: Express backend with in-memory + JSON-file runtime registry (id, pubkey, status)
- [ ] **OPER-02**: HTTP API exposed to Sonar MCP server and Demo UI
- [ ] **OPER-03**: WebSocket endpoint streams workflow log events to subscribed clients
- [ ] **OPER-04**: Coordinates `distribute` step — issues challenge, validates Ed25519 signature, ships encrypted payload, records ack
- [ ] **OPER-05**: Operator never persists private keys (verified by code review + test)

### Runtime

- [ ] **RUNT-01**: Node script generates Ed25519 keypair on boot and registers pubkey with Operator
- [ ] **RUNT-02**: Runtime listens on transport, signs Operator challenges, decrypts payload, reports "ready"
- [ ] **RUNT-03**: Three runtime instances (alpha, beta, gamma) can run concurrently in the demo

### Identity & Cloning Defense

- [ ] **IDEN-01**: Ed25519 challenge/response handshake is the only path to receive a key
- [ ] **IDEN-02**: A cloned binary using a copied keypair is rejected (revocation list or bound nonce); rejection appears in the workflow log
- [ ] **IDEN-03**: Revoked runtime fails the next handshake — visible in log

### Transport

- [ ] **TRAN-01**: `ITransport` interface defined; production impl is swap-able between AXL and WebSocket
- [ ] **TRAN-02**: WebSocket fallback transport works end-to-end as the demo baseline
- [ ] **TRAN-03**: AXL transport implementation present (or explicitly deferred with WebSocket as recorded fallback per the deferred-decision policy)

### MCP Server (Sonar)

- [ ] **MCP-01**: Node MCP server exposes `list_runtimes`, `revoke`, `get_workflow_log` tools
- [ ] **MCP-02**: Tools work end-to-end from Claude Desktop against a local Operator
- [ ] **MCP-03**: MCP server install instructions in README get a developer connected from Claude Desktop in <5 minutes

### KeeperHub Workflow

- [ ] **KEEP-01**: Workflow definition with 4 nodes: `generate_wallets` → `fund_wallets` → `distribute` → `deprecate`
- [ ] **KEEP-02**: On-chain steps execute on Base Sepolia with real txs visible on a block explorer
- [ ] **KEEP-03**: `distribute` node integrates with Operator (HTTP callback or native node) and waits for handshake completion
- [ ] **KEEP-04**: Workflow can be triggered from Claude Desktop via the Sonar MCP server

### On-Chain Contract

- [ ] **CHAIN-01**: FleetRegistry Solidity contract (~30 LOC) compiles and deploys to Base Sepolia
- [ ] **CHAIN-02**: `deprecate(address[])` callable with `WalletsDeprecated` event emitted
- [ ] **CHAIN-03**: Deploy script + deployed-address record in repo

### Demo UI

- [ ] **DEMO-01**: React app shows chat mirror of agent prompts/responses
- [ ] **DEMO-02**: Live log stream from Operator WebSocket rendered in UI
- [ ] **DEMO-03**: Per-runtime panels (alpha/beta/gamma) show status: registered, awaiting, received, deprecated, revoked

### Submission Package

- [ ] **SUBM-01**: Public repo with README — local setup in <5 minutes
- [ ] **SUBM-02**: 90-second demo video recorded and edited
- [ ] **SUBM-03**: End-to-end demo run from a real Claude Desktop prompt with 4 nodes executing and identity check rejecting a clone
- [ ] **SUBM-04**: Submission shipped to ETHGlobal OpenAgents — track *Best Use of KeeperHub* — before deadline (2026-05-03)
- [ ] **SUBM-05**: Architecture + Foja-upgrade documentation written (`docs/ARCHITECTURE.md`, `docs/UPGRADE-TO-FOJA.md`, `docs/CLAUDE-DESKTOP-SETUP.md`, `docs/DEMO-SCRIPT.md`)
- [ ] **SUBM-06**: Builder Feedback Bounty submission with structured feedback on the KeeperHub MCP server

## v2 Requirements

Deferred to post-hackathon.

### Foja Upgrade

- **FOJA-01**: Replace Ed25519 challenge/response with ZK identity proof under the same `ITransport` API
- **FOJA-02**: Validate proof on-chain via verifier contract

### Hardening

- **HARD-01**: Multi-tenant Operator (auth, isolated registries)
- **HARD-02**: Recovery flow if a runtime loses its keypair
- **HARD-03**: Persistent registry (Postgres/SQLite) replacing JSON file
- **HARD-04**: Mainnet deploy of FleetRegistry

## Out of Scope

| Feature | Reason |
|---------|--------|
| Trading or DEX integrations (Hyperliquid/Drift/GMX) | Runtimes only receive keys and report "ready" — trading is downstream of the demo's threat model |
| Persistence beyond JSON file | Demo scope; production hardening is v2 |
| Multi-tenant Operator | Out of demo scope; v2 |
| Runtime keypair recovery | Operational concern, not part of the threat model the demo addresses |
| Real Foja (ZK identity) | Too heavy for 5-day budget; Ed25519 stub uses same API shape, upgrade is documented |
| Auto-trigger of agent without human prompt | Demo is prompt-driven |
| Mainnet deploy | Testnet only (Base Sepolia) |
| Token economics or staking | Not part of the product |
| i18n of landing | English only for hackathon |

## Traceability

Populated during roadmap creation (2026-04-27). Every v1 requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAND-01 | Phase 1 | Complete (01-01..01-04: live at https://sonar-henna.vercel.app/ with dark theme + sonar palette; visual + getComputedStyle confirmed) |
| LAND-02 | Phase 1 | Complete (01-03: live R3F Canvas with autonomous 2.4s ping/echo loop, three named ALPHA/BETA/GAMMA nodes pulsing on hit at 0.40/0.65/0.85, NodeBadge DOM overlays, prefers-reduced-motion guard, three.js split into 808KB lazy chunk; FPS >= 50 desktop; loop-liveness probed via window.__pingFrames in Playwright) |
| LAND-03 | Phase 1 | Complete (01-02: Nav + Hero + Problem + Approach + FlowDiagram + DemoCta + Footer composed in App.tsx with verbatim UI-SPEC §Copywriting Contract copy; Vitest + Playwright assert verbatim text and banned-word policy) |
| LAND-04 | Phase 1 | Complete (01-04: local LHCI 3/3 PASS LCP median 676ms; Vercel-preview LHCI 3/3 PASS LCP median 395ms vs https://sonar-henna.vercel.app/; LCP attribution proven = h1 via Playwright; CLS=0; axe-core WCAG2 A/AA clean) |
| WORK-01 | Phase 2 | Pending |
| WORK-02 | Phase 2 | Pending |
| WORK-03 | Phase 2 | Pending |
| OPER-01 | Phase 3 | Pending |
| OPER-02 | Phase 3 | Pending |
| OPER-03 | Phase 3 | Pending |
| OPER-04 | Phase 3 | Pending |
| OPER-05 | Phase 3 | Pending |
| RUNT-01 | Phase 3 | Pending |
| RUNT-02 | Phase 3 | Pending |
| RUNT-03 | Phase 3 | Pending |
| IDEN-01 | Phase 3 | Pending |
| IDEN-02 | Phase 3 | Pending |
| IDEN-03 | Phase 3 | Pending |
| TRAN-01 | Phase 3 | Pending |
| TRAN-02 | Phase 3 | Pending |
| MCP-01 | Phase 4 | Pending |
| MCP-02 | Phase 4 | Pending |
| MCP-03 | Phase 4 | Pending |
| CHAIN-01 | Phase 5 | Pending |
| CHAIN-02 | Phase 5 | Pending |
| CHAIN-03 | Phase 5 | Pending |
| KEEP-01 | Phase 5 | Pending |
| KEEP-02 | Phase 5 | Pending |
| KEEP-03 | Phase 5 | Pending |
| KEEP-04 | Phase 5 | Pending |
| DEMO-01 | Phase 6 | Pending |
| DEMO-02 | Phase 6 | Pending |
| DEMO-03 | Phase 6 | Pending |
| TRAN-03 | Phase 6 | Pending |
| SUBM-01 | Phase 7 | Pending |
| SUBM-02 | Phase 7 | Pending |
| SUBM-03 | Phase 7 | Pending |
| SUBM-04 | Phase 7 | Pending |
| SUBM-05 | Phase 7 | Pending |
| SUBM-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements enumerated by ID: 40 (LAND 4 + WORK 3 + OPER 5 + RUNT 3 + IDEN 3 + TRAN 3 + MCP 3 + KEEP 4 + CHAIN 3 + DEMO 3 + SUBM 6)
- Mapped to phases: 40
- Unmapped: 0
- Note: prior count line said "41 total" — reconciled to 40 by enumeration. Update here if a 41st requirement is added.

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 — traceability populated by roadmap creation*

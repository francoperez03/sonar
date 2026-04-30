# Phase 5: On-Chain + KeeperHub Workflow - Context

**Gathered:** 2026-04-29
**Revised:** 2026-04-30 (post-research reconciliation)
**Status:** Ready for planning

> **Revision note (2026-04-30):** RESEARCH.md established that KeeperHub is a hosted SaaS at `app.keeperhub.com` with a fixed catalog of built-in nodes (manual, webhook, web3, condition, math, schedule). It does **not** load user-authored TypeScript modules. The "native nodes" pattern in the open-source `KeeperHub/keeperhub` repo is the *Workflow DevKit* template, not the production runtime. Decisions D-05, D-06, D-07, D-08, D-10, D-11, D-13, D-14, D-15, D-16 have been replaced/revised; D-01..D-04, D-09, D-12 (semantics) carry forward unchanged. Original wording preserved in `05-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Phase 5 delivers the on-chain layer + a KeeperHub-hosted workflow that drives a real key rotation end-to-end on Base Sepolia. A FleetRegistry Solidity contract is deployed via Foundry; a 5-node graph runs in KeeperHub (manual trigger → webhook(generate) → web3.execute_transfer(fund) → webhook(distribute) → web3.execute_contract_call(deprecate)); the workflow integrates with the Operator's locked HTTP API (Phase 3 D-12, D-13) plus two new Operator routes (`/rotation/generate`, `/rotation/distribute`) added in this phase; the entire workflow can be triggered from Claude Desktop through a new `run_rotation` tool layered on the Phase 4 MCP server.

In scope:
- `contracts/FleetRegistry.sol` — minimal Solidity contract with `deprecate(address[])` + `WalletsDeprecated` event
- Foundry-based compile, test, and deploy tooling (`forge`/`cast`); deploy uses `contracts/.env` (separate from the workflow runtime secrets)
- Deployed-address record at `deployments/base-sepolia.json`
- `apps/keeperhub/` — **glue package only**: `workflow.json` (the {nodes, edges} graph), `src/publish-workflow.ts` (uploads/updates the workflow via KeeperHub's API), `src/poll-execution.ts` (long-lived poller forwarding tx hashes from KeeperHub run state into the Operator LogBus), `.env`, `.env.example`. **No node runtime code.**
- New Operator routes added in this phase: `POST /rotation/generate`, `POST /rotation/distribute`, `POST /rotation/complete` — workflow-facing aggregators that call into the existing Phase 3 surface
- Operator-side ephemeral wallet generation: `/rotation/generate` produces N EOAs, holds `{runId → [{address, privkey}]}` in an in-memory Map, returns only the public addresses to KeeperHub
- KeeperHub Turnkey wallet signs `fund_wallets` (`web3.execute_transfer`) and `deprecate` (`web3.execute_contract_call`); pre-funded via KeeperHub dashboard before the demo
- 1:1 ordered mapping of generated wallets to caller-provided `runtimeIds`
- Distribute integration: `/rotation/distribute` calls the existing Phase 3 `POST /distribute` per runtimeId with `{ runtimeId, payload: { walletAddress, privkey } }`, applies the 409 retry-with-backoff policy, aggregates acks, returns 200 only when ALL succeed (deprecate gating)
- New Sonar MCP tool `run_rotation({ runtimeIds, walletCount? })` layered on the Phase 4 MCP server; calls KeeperHub's run-trigger HTTP API directly with `KEEPERHUB_API_TOKEN`; returns `{ runId }` for Claude to poll/log
- Tx-hash observability: `apps/keeperhub/src/poll-execution.ts` polls KeeperHub run status, extracts tx_hash + explorer URL from web3 node outputs, forwards a `LogEntryMsg` to the Operator LogBus so existing `/logs` WS consumers (Phase 6 Demo UI) see them with no extra wiring
- Secrets isolation: KeeperHub holds its own Turnkey credentials (their dashboard); `apps/keeperhub/.env` holds only `KEEPERHUB_API_TOKEN` + `OPERATOR_BASE_URL`; FleetRegistry deploy privkey lives in `contracts/.env` (gitignored)

Out of scope (belongs to other phases):
- Phase 4 MCP server core tools (`list_runtimes`, `revoke`, `get_workflow_log`) — Phase 5 only ADDS `run_rotation` on top
- Demo UI rendering the workflow + tx hashes (Phase 6)
- AXL transport (Phase 6)
- Multi-tenant log filtering / per-tenant runs (HARD-01, v2)
- ZK-identity / Foja upgrade (v2)
- Persisted run history beyond `deployments/base-sepolia.json` and workflow logs
- Production-grade access control on the contract (no Ownable, no role checks — testnet demo scope)
- Self-hosting KeeperHub or authoring custom node modules (the SaaS does not support it; Workflow DevKit is a separate template, not a runtime)

</domain>

<decisions>
## Implementation Decisions

### FleetRegistry Contract (unchanged)
- **D-01:** **Minimal contract surface.** Only `function deprecate(address[] calldata) external` plus `event WalletsDeprecated(address[] wallets, uint256 timestamp)`. No `Ownable`, no register on-chain, no access control. ~10–15 LOC. Satisfies CHAIN-01..03 with the smallest possible attack surface for a testnet demo. Production-grade access control is explicitly deferred.
- **D-02:** **Foundry is the deploy tool.** `forge build`, `forge test`, `forge script ... --broadcast`. Single binary, Solidity-native testing, fast CI. Avoids polluting the pnpm workspace with a Hardhat dep tree.
- **D-03:** **Contract directory is `contracts/`** at repo root (NOT inside `apps/keeperhub/`). Foundry layout: `contracts/src/FleetRegistry.sol`, `contracts/test/FleetRegistry.t.sol`, `contracts/script/Deploy.s.sol`, `contracts/foundry.toml`. Keeps Solidity tooling cleanly separated from the TS workspace.
- **D-04:** **Deployed address is recorded at `deployments/base-sepolia.json`** with shape `{ FleetRegistry: { address, deployer, blockNumber, txHash, deployedAt } }`. Committed to the repo. Read by `apps/keeperhub` (when publishing the workflow.json) and by Operator/Phase 6 to know which contract to call.

### KeeperHub Workflow Shape (revised)
- **D-05:** **The workflow is a hosted graph in KeeperHub built from the SaaS's built-in node catalog — no user-authored TS nodes.** The 5-node canonical graph: `manual_trigger` → `webhook(POST {OPERATOR}/rotation/generate)` → `web3.execute_transfer(fund_wallets, signed by KeeperHub Turnkey)` → `webhook(POST {OPERATOR}/rotation/distribute)` → `web3.execute_contract_call(FleetRegistry.deprecate, signed by KeeperHub Turnkey)`. Single linear path; per-runtime fanout is hidden inside the Operator routes. Replaces the prior "native TS in-repo nodes" decision once research confirmed KeeperHub does not load user modules.
- **D-06:** **`apps/keeperhub/` is a glue package, not a node runtime.** Contents:
  - `workflow.json` — the {nodes, edges} graph definition consumable by KeeperHub's publish API
  - `src/publish-workflow.ts` — one-shot script: reads `workflow.json` + `deployments/base-sepolia.json`, substitutes the FleetRegistry address into the deprecate node's call data, uploads/updates the workflow in KeeperHub via their API
  - `src/poll-execution.ts` — long-lived poller: given a `runId`, polls KeeperHub's run-status endpoint, extracts tx hashes from web3 node outputs, POSTs `LogEntryMsg` to the Operator LogBus
  - `.env`, `.env.example`, `package.json` (per-package `tsc` build per Phase 2 D-13)
  No `src/nodes/` directory — that pattern was based on the wrong premise.
- **D-07:** **Privkeys are generated and held in the Operator (in-memory only); KeeperHub never sees them.** `POST /rotation/generate { runId, runtimeIds, walletCount }` produces `walletCount` EOAs, stores `{runId → [{address, privkey}, ...]}` in an in-process `Map`, and returns ONLY the public addresses + paired `runtimeId`s to KeeperHub. The `runtimeId` ordering is preserved 1:1 by index (D-09). KeeperHub's workflow context, logs, and run blob never carry privkeys. OPER-05 ("Operator never *persists* private keys") is preserved because the Map is memory-only and cleared after the deprecate tx confirms (D-21).
- **D-08:** **`run_rotation` is a NEW Sonar MCP tool that calls KeeperHub's run-trigger HTTP API directly.** Tool input: `{ runtimeIds: string[], walletCount?: number }`. The tool authenticates with `KEEPERHUB_API_TOKEN` (read from the MCP server's env), POSTs to KeeperHub's run-create endpoint with the workflow ID + input payload, and returns `{ runId }` immediately. Claude polls progress via the existing `get_workflow_log` tool from Phase 4 (which now sees the LogBus stream that `poll-execution.ts` is feeding). MCP-to-KeeperHub is direct (no Operator hop) so the auth token stays scoped to the MCP process.

### Distribute ↔ Operator Integration (revised)
- **D-09:** **1:1 ordered wallet→runtime mapping by input order.** Unchanged. `run_rotation({ runtimeIds: [alpha, beta, gamma] })` causes `/rotation/generate` to produce exactly `runtimeIds.length` wallets, paired by index: `wallet[0] → alpha`, etc. Deterministic, sufficient for the 3-runtime demo.
- **D-10:** **Distribute is a webhook node hitting `POST {OPERATOR}/rotation/distribute`; the Operator does per-runtime fanout internally.** Webhook input: `{ runId, runtimeIds }` (NOT privkeys — Operator already has them in memory). The new `/rotation/distribute` route loops over runtimeIds, builds `{ runtimeId, payload: { walletAddress, privkey } }` per runtime from its in-memory Map, calls the existing Phase 3 `POST /distribute` (D-13) which NaCl-box-encrypts toward the runtime pubkey (Phase 3 D-02). Aggregates acks. Returns 200 only when ALL runtimes ack `received`; returns 4xx if any fail.
- **D-11:** **409 retry policy lives inside `/rotation/distribute`, not in the workflow node.** Per-runtime exponential backoff: 1s, 3s, 8s (3 attempts total). Each attempt emits a `log_entry` via the existing LogBus. After all attempts fail for a given runtime, the route accumulates the failure but continues with other runtimes; final response is 4xx with the per-runtime ack list. The webhook node sees one HTTP response — pass/fail — and KeeperHub's edge to deprecate fires only on 200.
- **D-12:** **Deprecate is gated on ALL distribute acks — enforcement is server-authoritative.** Unchanged in intent; revised in mechanism. The `/rotation/distribute` route returning 200 IS the gate; KeeperHub's static edge from the distribute webhook to the deprecate web3 node only traverses on a successful HTTP response. If any runtime fails distribute, the route returns 4xx, the workflow halts before deprecate, and the corresponding wallets are NOT deprecated. Preserves the invariant that deprecated wallets always have a live successor. No condition node needed in KeeperHub — the gate is in the Operator response code.

### Secrets & On-Chain Operations (revised)
- **D-13:** **`apps/keeperhub/.env` holds only `KEEPERHUB_API_TOKEN` + `OPERATOR_BASE_URL`.** No `DEPLOYER_PRIVKEY`, no `FUNDING_PRIVKEY`, no RPC URL. The `.env.example` template is committed; the real `.env` is gitignored. The Operator package has zero read access. OPER-05 holds because the only privkey in the system at runtime is the per-run ephemeral wallet (which lives in Operator memory only, D-07/D-21) — every long-lived signing key (KeeperHub Turnkey, deploy key) lives outside the Operator process.
- **D-14:** **`fund_wallets` is signed by KeeperHub's built-in Turnkey wallet, pre-funded via the KeeperHub dashboard before the demo.** `web3.execute_transfer` node sends a fixed amount (default 0.001 ETH, tunable in `workflow.json`) from the Turnkey-managed wallet to each generated wallet. No live-faucet dependency during the recorded run. We do not custody the funding key — that's KeeperHub's responsibility per their Turnkey integration.
- **D-15:** **`BASE_SEPOLIA_RPC_URL` is configured in two scoped places, not in `apps/keeperhub/.env`.** (a) `contracts/.env` for Foundry deploys (defaults to `https://sepolia.base.org`, overridable to Alchemy/QuickNode for stability during the recorded deploy). (b) KeeperHub's web3 node configuration for chain/RPC (set via the KeeperHub dashboard or `workflow.json`, depending on the SaaS's node config surface — researcher pinned the exact path). The glue package itself never makes JSON-RPC calls.
- **D-16:** **Tx-hash observability: `poll-execution.ts` polls KeeperHub run state and forwards to the Operator LogBus.** Loop: every `runId` started by `run_rotation` is registered with the poller (handoff via the MCP tool's response or a tiny `/rotation/runs` registry on Operator); the poller fetches KeeperHub's run-status, walks completed web3 node outputs, extracts `tx_hash`, builds `LogEntryMsg` shape `{ event: 'tx_sent', txHash, explorerUrl: 'https://sepolia.basescan.org/tx/<hash>', node: 'fund_wallets' | 'deprecate' }`, POSTs to the Operator's LogBus ingestion path. Phase 6 Demo UI subscribes to `/logs` WS (Phase 3 D-14) and renders Basescan links with zero new wiring. The KeeperHub native UI is also a fallback view.

### New decisions (this phase, post-pivot)
- **D-18:** **Operator gains exactly three new HTTP routes for this phase: `POST /rotation/generate`, `POST /rotation/distribute`, `POST /rotation/complete`.** All under a `/rotation/*` prefix to distinguish from Phase 3's per-runtime `/distribute`/`/revoke`/`/runtimes` surface. Auth: a shared bearer token (`KEEPERHUB_WEBHOOK_SECRET`) configured on Operator and as the webhook auth header in `workflow.json`. These are workflow-facing aggregators; they call into the locked Phase 3 surface internally and do NOT change the Phase 3 contract.
- **D-19:** **Privkey TTL: in-memory entries are cleared when `POST /rotation/complete` is called.** `/rotation/complete` is a final webhook node fired AFTER the deprecate web3 node confirms (KeeperHub's "on success" edge). Body: `{ runId, deprecateTxHash }`. Operator removes `runId` from the privkey Map, emits a final `LogEntryMsg`, and considers the run terminal. If `/rotation/complete` is never called (workflow crashes mid-flight), a 10-minute TTL sweeper evicts stale entries as a safety net — a belt-and-suspenders measure for OPER-05.
- **D-20:** **Poller registration: when `run_rotation` MCP tool returns `{ runId }`, it ALSO POSTs `{ runId }` to a new `apps/keeperhub` poller endpoint (or appends to a shared file/queue) so `poll-execution.ts` knows what to watch.** Exact transport (HTTP vs file vs in-process if poller is colocated with MCP) is Claude's discretion during planning — pick the lowest-risk path for a 5-day demo. Goal: every triggered run has tx hashes mirrored to LogBus without manual operator action.

### Research Mandate (status: SATISFIED)
- **D-17:** **KeeperHub deep-dive research is complete.** RESEARCH.md (cached) establishes:
  - KeeperHub is a hosted SaaS; no user-authored native nodes are supported in the production runtime
  - The built-in node catalog (manual, webhook, web3, condition, math, schedule) is sufficient for the 5-node graph above
  - The `KeeperHub/keeperhub` open-source repo is the Workflow DevKit template, distinct from the SaaS runtime — out of scope for our submission
  - KeeperHub Turnkey wallets sign web3 nodes from the dashboard
  - Run trigger, status polling, and log retrieval endpoints are HTTP/JSON
  Any remaining unknowns (exact endpoint paths, auth header names, web3 node config schema for chain/RPC, exact poll interval limits) are pinned in RESEARCH.md or are tagged "to confirm during planning" in `<canonical_refs>` below.

### Folded Todos
None — no backlog todos applicable to this phase.

### Claude's Discretion
- Exact directory layout inside `apps/keeperhub/src/` (naming of poller registry, helpers)
- Choice of EVM client library for the Foundry-side scripts and any utility wrappers (`viem` recommended; not used for fund/deprecate signing since KeeperHub Turnkey owns those txs)
- In-process privkey Map shape on Operator (`Map<runId, Wallet[]>` vs nested map; LRU vs plain object)
- Retry timing tuning inside `/rotation/distribute` (1s/3s/8s defaults — tune if Phase 3 `/distribute` semantics demand otherwise)
- Whether the poller registration (D-20) uses HTTP, a file queue, or in-process if the poller and MCP server colocate — pick the lower-risk option during planning
- Funding amount per wallet inside `workflow.json` (0.001 ETH default — adjust if Base Sepolia gas demands more or KeeperHub Turnkey balance constrains it)
- Whether `/rotation/complete` is fired by an explicit webhook node OR inferred by the poller observing the deprecate tx receipt (both preserve D-21; planner picks)
- TTL value for the privkey Map sweeper (10 minutes default — tune to longest plausible workflow duration)
- Contract test depth (a single happy-path + one revert test is sufficient for CHAIN-01..03)
- Whether `forge script` Deploy uses `--broadcast` directly or wraps in a `pnpm deploy:contracts` script

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core Value (Operator never *persists* privkeys), threat model, custody model
- `.planning/REQUIREMENTS.md` §On-Chain (CHAIN-01..03), §KeeperHub (KEEP-01..04), OPER-05 — the requirements this phase delivers and the invariants it must preserve
- `.planning/ROADMAP.md` §"Phase 5: On-Chain + KeeperHub Workflow" — goal, dependencies, success criteria (1–5)
- `CLAUDE.md` — Tech stack constraints (TS/Node 20+/pnpm; Solidity; Base Sepolia testnet)

### This phase
- `.planning/phases/05-on-chain-keeperhub-workflow/05-RESEARCH.md` — **MANDATORY pre-planning read.** Cached KeeperHub deep-dive: SaaS architecture, built-in node catalog, run-trigger/status/log API endpoints, Turnkey signing model, what is NOT supported (no native TS modules in production), ETHGlobal track positioning. The reconciliation in this CONTEXT.md is grounded in RESEARCH.md findings.
- `.planning/phases/05-on-chain-keeperhub-workflow/05-MANUAL-OPS.md` — canonical list of human-only operations (KeeperHub dashboard, faucet, Turnkey wallet pre-fund, Basescan verification). Every manual step must surface as an explicit task or prerequisite during planning.

### Locked upstream contracts (Phase 3)
- `.planning/phases/03-operator-runtime-identity-core/03-CONTEXT.md` §decisions — D-12 (`/distribute` 409 contract), D-13 (HTTP control surface), D-14 (open-subscribe LogBus), D-02 (NaCl box payload encryption), D-19 (memory-only sensitive material)
- `apps/operator/src/transport/` — server transport + log broadcast implementation
- `packages/shared/src/messages/` — locked Zod schemas; Phase 5 produces payloads conforming to `EncryptedPayloadMsg` (post-Operator encryption) and consumes `LogEntryMsg`/`StatusChangeMsg` shapes

### Phase 4 dependency
- `.planning/phases/04-sonar-mcp-server/` — Sonar MCP server. Phase 5 adds `run_rotation` as a NEW tool layered on top. If Phase 4 has not yet been planned at execution time, Phase 5's MCP work depends on it landing first.

### Forward references (locked by this CONTEXT.md, consumed by later phases)
- This CONTEXT.md D-16 (LogBus tx-hash entries with explorerUrl) — Phase 6 Demo UI consumes these for Basescan links
- This CONTEXT.md D-04 (`deployments/base-sepolia.json`) — Phase 6 + Phase 7 README/docs reference this file
- This CONTEXT.md D-18 (new Operator `/rotation/*` routes) — adds surface area beyond Phase 3 D-13; Phase 6/7 may reference for end-to-end traces

### External docs (consult during planning, not pre-locked)
- KeeperHub SaaS docs (run-trigger endpoint, status polling, log retrieval, web3 node chain config) — researcher pinned exact paths in RESEARCH.md
- Foundry Book — `forge`, `cast`, `forge-std`, scripting deploys to Base Sepolia
- Base Sepolia docs — chain ID 84532, public RPC, Coinbase faucet, Basescan explorer URL `https://sepolia.basescan.org/tx/<hash>`
- `viem` (recommended for Foundry-adjacent helpers) — wallet, public client, contract write/read against Base Sepolia

### To confirm during planning (delta after the pivot)
- Exact KeeperHub auth-header convention for run-trigger and webhook nodes (e.g., `Authorization: Bearer <token>` vs `X-KeeperHub-Token`)
- Whether KeeperHub's web3 node accepts inline contract ABI fragments or requires registering ABIs in its dashboard (impacts `publish-workflow.ts` ergonomics)
- Whether KeeperHub fires a "workflow finished" callback we can use for `/rotation/complete` (D-21) or whether the poller infers completion from the deprecate node's tx receipt
- KeeperHub's run-status poll-rate ceiling (informs `poll-execution.ts` interval)
- Whether KeeperHub Turnkey supports per-workflow scoped wallets or shares one wallet across the org (informs the funding pre-load step in MANUAL-OPS.md)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Operator HTTP API (Phase 3)** — `POST /distribute`, `POST /revoke`, `GET /runtimes` already implemented. Phase 5's new `/rotation/distribute` route calls `/distribute` internally per runtimeId; the locked 409 contract is consumed verbatim.
- **Operator LogBus + `/logs` WS (Phase 3)** — Phase 5 emits `log_entry` events via this stream so on-chain tx hashes flow into the existing log infra (and into Phase 6 Demo UI for free). `poll-execution.ts` is a producer; `get_workflow_log` (Phase 4 MCP tool) is a consumer.
- **`@sonar/shared` message schemas** — `LogEntryMsg`, `StatusChangeMsg` already locked; Phase 5's tx events conform to `LogEntryMsg`.
- **pnpm workspace + ESM/Node 20 conventions (Phase 2)** — `apps/keeperhub/` follows the same `package.json` shape as `apps/operator` and `apps/runtime`.

### Established Patterns
- **Per-package `tsc` build** (Phase 2 D-13) — `apps/keeperhub/` builds independently to `dist/`; `publish-workflow.ts` and `poll-execution.ts` ship as compiled JS.
- **Zod schemas at trust boundaries** (Phase 2 D-09) — Phase 5 validates the `run_rotation` MCP input, the new `/rotation/*` route bodies, the privkey-Map handoff between routes, and any inbound LogBus payloads.
- **Discriminated unions on `type`** (Phase 2 D-10) — workflow log entries follow the same pattern.
- **Memory-only sensitive material** (Phase 3 D-19) — Phase 5 mirrors this for generated wallet privkeys: held in process memory keyed by `runId`, never written to disk, cleared via D-21 plus a TTL sweeper.

### Integration Points
- **Phase 4 (MCP server)** is the host for the new `run_rotation` tool — Phase 5 extends it without changing the existing 3 tools and without introducing a second auth surface (`KEEPERHUB_API_TOKEN` lives in the MCP process env).
- **Phase 3 Operator** gains three new `/rotation/*` routes — additive, no Phase 3 contract changes.
- **Phase 6 (Demo UI)** subscribes to `ws://operator/logs` (Phase 3 D-14) and will see `tx_sent` events emitted by `poll-execution.ts` with Basescan links pre-formed.
- **Phase 7 (Submission)** depends on `deployments/base-sepolia.json` for README links, the published KeeperHub workflow URL for the track narrative, and a clean end-to-end run for the demo video.

</code_context>

<specifics>
## Specific Ideas

- The track target remains **Best Use of KeeperHub** (ETHGlobal OpenAgents). The pivot — using KeeperHub's built-in nodes as the workflow rather than authoring native TS modules — is the *correct* deep integration: it exercises the SaaS as designed (manual + webhook + web3 + Turnkey), demonstrates a real production rotation flow, and avoids the misconception that KeeperHub is self-hostable. RESEARCH.md frames this as the strongest narrative for the track.
- OPER-05 ("never *persists* privkeys") is the load-bearing invariant. The pivot puts ephemeral generated privkeys in Operator memory (D-07) — this is allowed by the literal requirement (in-memory ≠ persisted) and is bounded by D-21 (cleared after deprecate) plus a TTL sweeper. Reviewers should grep for any path that writes the privkey Map to disk, logs, or response bodies — there must be none.
- The deprecate-after-all-acks rule (D-12) was preserved through the pivot: enforced now by `/rotation/distribute` returning 200 only on full success. Failing visibly is better than rotating into a black hole on a recorded demo.
- Retry-with-backoff (D-11) is bounded at 3 attempts to avoid infinite loops during the recorded run — a known hackathon-demo failure mode.
- KeeperHub's Turnkey signs fund + deprecate — we deliberately do NOT custody those keys. The only chain-signing key our codebase touches is the FleetRegistry deployer in `contracts/.env`, used once before the demo.

</specifics>

<deferred>
## Deferred Ideas

- **Self-hosted KeeperHub / Workflow DevKit deployment** — explicitly deferred. KeeperHub SaaS is the production target. DevKit is a separate evaluation track if v2 wants on-prem.
- **Production-grade FleetRegistry access control** (Ownable, role-based) — explicitly deferred. Testnet demo scope; v2 if Foja/multi-tenant lands.
- **On-chain `register(address[])` event mirror** of the Operator registry — would enrich the demo narrative but is not in CHAIN-01..03 and adds tx surface.
- **HD-wallet / mnemonic-based key generation** — current decision is one fresh EOA per runtime. Mnemonics deferred until a multi-key-per-runtime use case appears.
- **Live faucet integration during `fund_wallets`** — deferred in favor of a pre-funded KeeperHub Turnkey wallet. If a demo ever needs unattended re-funding, faucet API integration goes here.
- **Round-robin / N-to-M wallet→runtime mapping** — current decision is strict 1:1 by index. Generalize only if a future workflow targets arbitrary wallet counts.
- **Per-wallet deprecate transactions** — rejected in favor of a single batched call (D-12 gating + single `deprecate(address[])` call).
- **Persisted run history** beyond workflow logs — no SQLite/JSON store of past runs in Phase 5. Phase 6 + Phase 7 surface live runs only; historical runs are out of scope.
- **Foundry keystore / hardware-wallet signing** for deploys — deferred. Plain `contracts/.env` is acceptable for testnet hackathon scope.
- **BYO Turnkey policy / external signer integration** — deferred. KeeperHub's built-in Turnkey wallet is sufficient for the demo; full custody story is v2.
- **MCP-to-MCP integration with KeeperHub** — deferred. `run_rotation` calls KeeperHub's HTTP API directly; if KeeperHub later ships a stable MCP surface, we can swap the transport without changing the tool contract.

</deferred>

---

*Phase: 05-on-chain-keeperhub-workflow*
*Context gathered: 2026-04-29*
*Reconciled post-research: 2026-04-30*

# Phase 5: On-Chain + KeeperHub Workflow - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the on-chain layer + the 4-node KeeperHub workflow that drives a real key rotation end-to-end on Base Sepolia. A FleetRegistry Solidity contract is deployed; KeeperHub runs `generate_wallets` → `fund_wallets` → `distribute` → `deprecate`; the `distribute` node integrates with the Operator's locked HTTP API (Phase 3 D-12, D-13) and waits for handshake completion before deprecating; the entire workflow can be triggered from Claude Desktop through a new MCP tool that builds on the Phase 4 MCP server.

In scope:
- `contracts/FleetRegistry.sol` — minimal Solidity contract with `deprecate(address[])` + `WalletsDeprecated` event
- Foundry-based compile, test, and deploy tooling (`forge`/`cast`)
- Deployed-address record at `deployments/base-sepolia.json`
- `apps/keeperhub/` — new workspace package containing the 4 native TS workflow nodes plus a `workflow.json` definition consumable by KeeperHub MCP
- Funding-wallet-driven testnet ETH distribution (`fund_wallets`)
- 1:1 ordered mapping of generated wallets to caller-provided `runtimeIds`
- Distribute integration: HTTP `POST /distribute` against the Operator (already locked Phase 3) with a `{ runtimeId, payload: { walletAddress, privkey } }` shape, retry-with-backoff on 409, and ack-gating before deprecate
- New Sonar MCP tool `run_rotation({ runtimeIds, walletCount })` layered on top of the Phase 4 MCP server; returns a `runId` Claude can use to poll/log
- Tx-hash observability: every on-chain action emits a `log_entry` to the Operator LogBus AND is preserved in the native workflow log, with explorer URLs for Basescan
- Secrets isolation: deployer + funding privkeys live in `apps/keeperhub/.env` (gitignored, with `.env.example` template); Operator never reads these — OPER-05 invariant preserved

Out of scope (belongs to other phases):
- Phase 4 MCP server core tools (`list_runtimes`, `revoke`, `get_workflow_log`) — Phase 5 only ADDS `run_rotation` on top
- Demo UI rendering the workflow + tx hashes (Phase 6)
- AXL transport (Phase 6)
- Multi-tenant log filtering / per-tenant runs (HARD-01, v2)
- ZK-identity / Foja upgrade (v2)
- Persisted run history beyond `deployments/base-sepolia.json` and workflow logs
- Production-grade access control on the contract (no Ownable, no role checks — testnet demo scope)

</domain>

<decisions>
## Implementation Decisions

### FleetRegistry Contract
- **D-01:** **Minimal contract surface.** Only `function deprecate(address[] calldata) external` plus `event WalletsDeprecated(address[] wallets, uint256 timestamp)`. No `Ownable`, no register on-chain, no access control. ~10–15 LOC. Satisfies CHAIN-01..03 with the smallest possible attack surface for a testnet demo. Production-grade access control is explicitly deferred.
- **D-02:** **Foundry is the deploy tool.** `forge build`, `forge test`, `forge script ... --broadcast`. Single binary, Solidity-native testing, fast CI. Avoids polluting the pnpm workspace with a Hardhat dep tree.
- **D-03:** **Contract directory is `contracts/`** at repo root (NOT inside `apps/keeperhub/`). Foundry layout: `contracts/src/FleetRegistry.sol`, `contracts/test/FleetRegistry.t.sol`, `contracts/script/Deploy.s.sol`, `contracts/foundry.toml`. Keeps Solidity tooling cleanly separated from the TS workspace.
- **D-04:** **Deployed address is recorded at `deployments/base-sepolia.json`** with shape `{ FleetRegistry: { address, deployer, blockNumber, txHash, deployedAt } }`. Committed to the repo. Read by `apps/keeperhub` at runtime to know which contract to call.

### KeeperHub Workflow Shape
- **D-05:** **Native TS in-repo nodes.** Each of the 4 nodes is a TS module under `apps/keeperhub/src/nodes/{generate,fund,distribute,deprecate}.ts`. KeeperHub MCP loads them as native nodes. Best fit for the *Best Use of KeeperHub* track — demonstrates deep integration, not a thin HTTP shim.
- **D-06:** **New workspace package `apps/keeperhub/`.** Holds the workflow definition (`workflow.json`), the 4 node modules, and a small bootstrap script. Versioned and reviewed alongside the rest of the code. The Operator stays untouched (preserves OPER-05).
- **D-07:** **Wallet handoff via the workflow context object.** `generate_wallets` emits `{ wallets: [{ address, privkeyRef }] }` into the KeeperHub run context; downstream nodes resolve `privkeyRef` against an in-process secret map keyed by `runId`. Privkeys never enter the workflow's serialized log/blob.
- **D-08:** **`run_rotation` is a NEW Sonar MCP tool added in Phase 5.** Phase 4 ships `list_runtimes`, `revoke`, `get_workflow_log`; Phase 5 layers `run_rotation({ runtimeIds: string[], walletCount?: number })` on top of the same MCP server. The tool kicks off the KeeperHub workflow and returns `{ runId }`. Claude polls progress via the existing `get_workflow_log` tool.

### Distribute ↔ Operator Integration
- **D-09:** **1:1 ordered wallet→runtime mapping by input order.** `run_rotation({ runtimeIds: [alpha, beta, gamma] })` causes `generate_wallets` to produce exactly `runtimeIds.length` wallets, paired by index: `wallet[0] → alpha`, `wallet[1] → beta`, etc. Deterministic, sufficient for the 3-runtime demo.
- **D-10:** **Distribute payload shape:** `{ runtimeId, payload: { walletAddress, privkey } }` posted to `POST /distribute` (Phase 3 D-13). Operator NaCl-box-encrypts `payload` toward the runtime's pubkey before delivery (Phase 3 D-02). The runtime decrypts and assumes the new identity.
- **D-11:** **409 retry policy.** Distribute node retries with exponential backoff: 1s, 3s, 8s (3 attempts total). Each attempt emits a `log_entry` via the Operator LogBus. After all attempts fail, the node marks the run as `failed` and the workflow does NOT proceed to `deprecate`. No infinite loops — demo-safe.
- **D-12:** **Deprecate is gated on ALL distribute acks.** The workflow only calls `deprecate(oldAddresses[])` once every targeted runtime has returned `status=received`. If any distribute fails, the corresponding wallets are NOT deprecated — preserves the invariant that deprecated wallets always have a live successor.

### Secrets & On-Chain Operations
- **D-13:** **Privkeys live in `apps/keeperhub/.env`** (gitignored), with a committed `.env.example` template. Variables: `DEPLOYER_PRIVKEY`, `FUNDING_PRIVKEY`, `BASE_SEPOLIA_RPC_URL`. The Operator package has zero read access to these — OPER-05 holds because the secret surface lives entirely in a separate workspace package.
- **D-14:** **Funding wallet is pre-loaded from a public Sepolia faucet** before the demo. `fund_wallets` sends a fixed amount (default 0.001 ETH) from `FUNDING_PRIVKEY` to each generated wallet via a single batched flow. No live-faucet dependency during the recorded run.
- **D-15:** **`BASE_SEPOLIA_RPC_URL` defaults to `https://sepolia.base.org`** (public endpoint) but is overridable via env. Demo can swap to Alchemy/QuickNode if stability matters during recording.
- **D-16:** **Tx-hash observability:** every on-chain action (deploy, fund tx, deprecate tx) emits a `log_entry` to the Operator LogBus via an HTTP ingestion path, with shape `{ event: 'tx_sent', txHash, explorerUrl: 'https://sepolia.basescan.org/tx/<hash>', node: 'fund_wallets' | 'deprecate' }`. Tx hashes also remain in the native KeeperHub workflow log. Phase 6 Demo UI will render the LogBus stream with clickable Basescan links.

### Research Mandate
- **D-17:** **KeeperHub deep-dive is a precondition to planning.** Before `gsd-planner` writes any task specs, `gsd-phase-researcher` must produce a complete map of KeeperHub's native node contract, workflow schema, run/trigger API, official SDK surface, logging hooks, secret model, MCP integration story, on-chain helpers, and version pinning. The exact deliverables list lives in `<canonical_refs>` under "MANDATORY KeeperHub research". The plan must cite specific SDK function names and endpoints, not generic references. Rationale: KeeperHub is the ETHGlobal track target; flying blind on its API is the single biggest risk to Phase 5.

### Folded Todos
None — no backlog todos applicable to this phase.

### Claude's Discretion
- Exact directory layout inside `apps/keeperhub/src/` (e.g., `nodes/`, `chain/`, `wallets/`)
- Choice of EVM client library (`viem` recommended; `ethers` acceptable) — pick whichever has better KeeperHub-native ergonomics
- In-process secret map shape for `privkeyRef` (Map keyed by `runId+index`, WeakMap, etc.)
- Retry timing tuning (1s/3s/8s are defaults; tune if KeeperHub run timeouts demand otherwise)
- Whether the LogBus ingestion path is a new `POST /logs` route on the Operator or a direct WS publish — pick the lower-risk option during planning
- Funding-wallet ETH amount per wallet (0.001 default — adjust if Base Sepolia gas demands more)
- Whether `forge script` Deploy uses `--broadcast` directly or wraps in a `pnpm deploy:contracts` script
- Contract test depth (a single happy-path + one revert test is sufficient for CHAIN-01..03)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core Value (Operator never sees privkeys), threat model, custody model
- `.planning/REQUIREMENTS.md` §On-Chain (CHAIN-01..03), §KeeperHub (KEEP-01..04) — the 7 v1 requirements this phase delivers
- `.planning/ROADMAP.md` §"Phase 5: On-Chain + KeeperHub Workflow" — goal, dependencies, success criteria (1–5)
- `CLAUDE.md` — Tech stack constraints (TS/Node 20+/pnpm; Solidity; Base Sepolia testnet)

### Locked upstream contracts (Phase 3)
- `.planning/phases/03-operator-runtime-identity-core/03-CONTEXT.md` §decisions — D-12 (`/distribute` 409 contract), D-13 (HTTP control surface), D-14 (open-subscribe LogBus), D-02 (NaCl box payload encryption)
- `apps/operator/src/transport/` — server transport + log broadcast implementation
- `packages/shared/src/messages/` — locked Zod schemas; Phase 5 produces payloads that match `EncryptedPayloadMsg` (post-Operator encryption) and consumes `LogEntryMsg`/`StatusChangeMsg` shapes

### Phase 4 dependency
- `.planning/phases/04-...` (TBD) — Sonar MCP server; Phase 5 adds `run_rotation` as a NEW tool layered on top. If Phase 4 has not yet been planned at execution time, Phase 5's MCP work depends on it landing first.

### Forward references (locked by this CONTEXT.md, consumed by later phases)
- This CONTEXT.md D-16 (LogBus tx-hash entries with explorerUrl) — Phase 6 Demo UI consumes these for Basescan links
- This CONTEXT.md D-04 (`deployments/base-sepolia.json`) — Phase 6 + Phase 7 README/docs reference this file

### External library docs (consult during planning, not pre-locked)
- Foundry Book — `forge`, `cast`, `forge-std`, scripting deploys to Base Sepolia
- Base Sepolia docs — chain ID 84532, public RPC, Coinbase faucet
- `viem` (recommended) — wallet, public client, contract write/read against Base Sepolia

### MANDATORY KeeperHub research (researcher must produce this before planning)

KeeperHub is the ETHGlobal track target — Phase 5 plan cannot start until the researcher has produced a complete map of KeeperHub's surface. Treat this as a first-class deliverable of `RESEARCH.md`, not a footnote.

The research output must cover:
1. **Native node authoring contract** — exact module/export shape KeeperHub expects, lifecycle hooks (init/run/cleanup), how inputs/outputs are typed, error propagation, timeout semantics, retry hooks
2. **Workflow definition format** — `workflow.json` (or equivalent) schema: node ordering, branching, conditional edges, context-passing rules, what fields KeeperHub reserves
3. **Run/trigger API** — every endpoint to start a run, get status, fetch logs, cancel; auth model; rate limits; idempotency keys
4. **SDK surface** — official SDK(s) for native node authoring (TS/JS first), version pinning, install path, breaking-change history if relevant
5. **Logging + observability hooks** — how a node emits logs that show up in KeeperHub's UI, structured-log support, ability to attach metadata (e.g., txHash) to log lines
6. **Secret/credential model** — how KeeperHub expects nodes to access secrets at runtime (env, vault integration, per-run inputs); confirms our D-13 `.env` plan is compatible
7. **MCP integration story** — how KeeperHub exposes itself as MCP, what MCP tools it ships, how Sonar MCP's `run_rotation` should call into KeeperHub (direct API vs MCP-to-MCP vs in-process SDK)
8. **On-chain helpers** — does KeeperHub ship native primitives for EVM tx submission/wait-for-receipt? If so, prefer them over hand-rolled `viem` calls
9. **Pitfalls / non-obvious limits** — concurrency caps, payload size, log retention, cold-start latency
10. **Versions to pin** — exact SDK + workflow-schema versions used at submission

The researcher should consult `mcp__context7__*` for KeeperHub docs/SDK, plus official KeeperHub docs and any ETHGlobal track-specific guidance. Output should be concrete enough that the planner can write task specs without re-researching (e.g., name the exact SDK function, not "KeeperHub's run API").

### To be added during research (output goes into RESEARCH.md)
- KeeperHub MCP API specifics (run trigger endpoint, log retrieval) — researcher pins exact endpoints + versions
- Confirmation that our 4-node native-TS plan (D-05) is the idiomatic KeeperHub pattern, not a workaround
- Base Sepolia explorer URL pattern confirmation (`https://sepolia.basescan.org/tx/<hash>`)
- Whether KeeperHub's logging hooks can carry the `{txHash, explorerUrl}` metadata D-16 wants, or whether we route via the Operator LogBus only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Operator HTTP API (Phase 3)** — `POST /distribute`, `POST /revoke`, `GET /runtimes` already implemented. Phase 5 calls `/distribute` from the workflow's `distribute` node and depends on the locked 409 contract.
- **Operator LogBus + `/logs` WS (Phase 3)** — Phase 5 emits `log_entry` events via this stream so on-chain tx hashes flow into the existing log infra (and into Phase 6 Demo UI for free).
- **`@sonar/shared` message schemas** — `LogEntryMsg`, `StatusChangeMsg` already locked; Phase 5's tx events conform to `LogEntryMsg`.
- **pnpm workspace + ESM/Node 20 conventions (Phase 2)** — `apps/keeperhub/` follows the same `package.json` shape as `apps/operator` and `apps/runtime`.

### Established Patterns
- **Per-package `tsc` build** (Phase 2 D-13) — `apps/keeperhub/` builds independently to `dist/`.
- **Zod schemas at trust boundaries** (Phase 2 D-09) — Phase 5 validates the `run_rotation` MCP input, the workflow context handoff between nodes, and any inbound LogBus payloads.
- **Discriminated unions on `type`** (Phase 2 D-10) — workflow log entries follow the same pattern.
- **Memory-only sensitive material** (Phase 3 D-19) — Phase 5 mirrors this for generated wallet privkeys: held in process memory keyed by `runId`, never written to disk.

### Integration Points
- **Phase 4 (MCP server)** is the host for the new `run_rotation` tool — Phase 5 extends it without changing the existing 3 tools.
- **Phase 6 (Demo UI)** subscribes to `ws://operator/logs` (Phase 3 D-14) and will see `tx_sent` events emitted by Phase 5's on-chain nodes.
- **Phase 7 (Submission)** depends on `deployments/base-sepolia.json` for README links and on a clean end-to-end run for the demo video.

</code_context>

<specifics>
## Specific Ideas

- The track target is **Best Use of KeeperHub** (ETHGlobal OpenAgents). Every gray area was resolved toward "demonstrates deep, native KeeperHub integration" rather than "thin wrapper around external scripts" — hence native TS nodes (D-05) and a dedicated `apps/keeperhub/` package (D-06).
- The OPER-05 invariant ("Operator never holds privkeys") was treated as load-bearing. Decisions D-06, D-07, D-13 all explicitly route chain-signing keys away from the Operator process, even though it would be marginally simpler to colocate them.
- The deprecate-after-all-acks rule (D-12) was chosen over the more demo-flashy per-wallet variant because it preserves the safety invariant that deprecated wallets always have a live successor. Failing visibly is better than rotating into a black hole on a recorded demo.
- Retry-with-backoff (D-11) is bounded at 3 attempts to avoid infinite loops during the recorded run — a known hackathon-demo failure mode.

</specifics>

<deferred>
## Deferred Ideas

- **Production-grade FleetRegistry access control** (Ownable, role-based) — explicitly deferred. Testnet demo scope; v2 if Foja/multi-tenant lands.
- **On-chain `register(address[])` event mirror** of the Operator registry — would enrich the demo narrative but is not in CHAIN-01..03 and adds tx surface.
- **HD-wallet / mnemonic-based key generation** — current decision is one fresh EOA per runtime. Mnemonics deferred until a multi-key-per-runtime use case appears.
- **Live faucet integration during `fund_wallets`** — deferred in favor of a pre-funded hot wallet. If a demo ever needs unattended re-funding, faucet API integration goes here.
- **Round-robin / N-to-M wallet→runtime mapping** — current decision is strict 1:1 by index. Generalize only if a future workflow targets arbitrary wallet counts.
- **Per-wallet deprecate transactions** — rejected in favor of a single batched call (D-12 gating + single `deprecate(address[])` call). Could revisit if granular per-wallet narrative is wanted in Phase 7's video.
- **Persisted run history** beyond workflow logs — no SQLite/JSON store of past runs in Phase 5. Phase 6 + Phase 7 surface live runs only; historical runs are out of scope.
- **Foundry keystore / hardware-wallet signing** for deploys — deferred. Plain `.env` is acceptable for testnet hackathon scope.

</deferred>

---

*Phase: 05-on-chain-keeperhub-workflow*
*Context gathered: 2026-04-29*

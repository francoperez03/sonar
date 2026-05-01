# Phase 5: On-Chain + KeeperHub Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 05-on-chain-keeperhub-workflow
**Areas discussed:** FleetRegistry contract, KeeperHub workflow shape, Distribute ↔ Operator, Secrets & on-chain ops

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| FleetRegistry contract | Solidity surface, deploy tooling, address record | ✓ |
| KeeperHub workflow shape | Node strategy, location, wallet handoff, trigger | ✓ |
| Distribute ↔ Operator | wallet→runtime mapping, payload, 409 retry, deprecate gating | ✓ |
| Secrets & on-chain ops | privkey storage, funding source, RPC, tx observability | ✓ |

**User's choice:** All four areas selected.

---

## FleetRegistry contract

### Q1: ¿Qué superficie tiene FleetRegistry?

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo: deprecate + event | Solo `deprecate(address[])` + `WalletsDeprecated` event. ~10–15 LOC. | ✓ |
| Mínimo + onlyOwner | Adds `Ownable` (OZ); only deployer can call. | |
| Register + deprecate | Adds `register(address[])` + event for full lifecycle. | |

### Q2: ¿Foundry o Hardhat?

| Option | Description | Selected |
|--------|-------------|----------|
| Foundry | `forge`/`cast`, single binary, Solidity-native tests. | ✓ |
| Hardhat | TS-native, easier pnpm integration, ~200MB JS deps. | |

### Q3: ¿Dónde guardamos la deployed address?

| Option | Description | Selected |
|--------|-------------|----------|
| `deployments/base-sepolia.json` | Committed JSON with address, deployer, block, txHash, deployedAt. | ✓ |
| Env var + README badge | `FLEET_REGISTRY_ADDRESS` in `.env.example` + README link. | |
| Foundry broadcast file | Use `broadcast/Deploy.s.sol/84532/run-latest.json` directly. | |

---

## KeeperHub workflow shape

### Q1: ¿Cómo se implementan los 4 nodos?

| Option | Description | Selected |
|--------|-------------|----------|
| Nativos TS in-repo | Native KeeperHub TS modules in `apps/keeperhub/`. | ✓ |
| HTTP-callback nodes | Thin KeeperHub nodes calling external HTTP service. | |
| Mixto | distribute native, chain ops via callbacks. | |

### Q2: ¿Dónde vive la definición + código?

| Option | Description | Selected |
|--------|-------------|----------|
| `apps/keeperhub/` | New workspace package, isolated. | ✓ |
| `packages/workflow/` | Shared library. Overkill for hackathon. | |
| `apps/operator/src/workflow/` | Inside Operator. Violates OPER-05 spirit. | |

### Q3: ¿Cómo se pasan las wallets entre nodos?

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow context object | `{wallets: [{address, privkeyRef}]}`; privkeys via in-process secret map. | ✓ |
| Privkeys inline en context | Privkeys as raw strings in workflow blob. | |
| Sidecar storage | File/Redis sidecar keyed by `runId`. | |

### Q4: ¿Cómo se dispara desde Claude Desktop?

| Option | Description | Selected |
|--------|-------------|----------|
| Tool nuevo `run_rotation` en Sonar MCP | Phase 5 layers `run_rotation({runtimeIds, walletCount})` on top of Phase 4. | ✓ |
| KeeperHub MCP directo | Claude calls KeeperHub MCP directly. | |
| CLI script + manual | `pnpm rotate` from terminal. | |

---

## Distribute ↔ Operator

### Q1: ¿Wallet → runtimeId mapping?

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 ordered by input | `runtimeIds[i]` ↔ `wallets[i]`. | ✓ |
| Round-robin pool | Wallet count independent of runtimeIds. | |
| Caller-specified mapping | Claude provides `[{runtimeId, walletAddress}]`. | |

### Q2: ¿Distribute payload shape?

| Option | Description | Selected |
|--------|-------------|----------|
| `{runtimeId, payload: {walletAddress, privkey}}` | Full pair, encrypted by Operator NaCl box. | ✓ |
| `{runtimeId, payload: {privkey}}` | Privkey only. | |
| `{runtimeId, payload: {mnemonic}}` | HD wallet mnemonic. | |

### Q3: ¿409 retry policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Backoff 1s/3s/8s, fail after 3 | Bounded retries, mark run failed, do NOT deprecate. | ✓ |
| Fail inmediato | First 409 = abort. | |
| Retry indefinido | Loop until success. | |

### Q4: ¿Cuándo dispara deprecate?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo tras ack de TODOS los distribute | All-or-nothing batch deprecate. | ✓ |
| Por wallet individual | Each ack triggers its own deprecate tx. | |
| Deprecate de todas siempre | Run regardless of distribute outcome. | |

---

## Secrets & on-chain ops

### Q1: ¿Dónde vive deployer/funding privkey?

| Option | Description | Selected |
|--------|-------------|----------|
| `.env` en `apps/keeperhub` | Gitignored .env + .env.example template. | ✓ |
| 1Password / keychain | Higher friction for CI / collaborators. | |
| Foundry encrypted keystore | Good for deployer, awkward for funding. | |

### Q2: ¿Funding source?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-loaded funding wallet | Hot wallet pre-funded from public faucet; sends 0.001 ETH per gen wallet. | ✓ |
| Faucet API directo | Live faucet calls per run. | |
| Sin funding | Skip ETH funding. | |

### Q3: ¿RPC config?

| Option | Description | Selected |
|--------|-------------|----------|
| `BASE_SEPOLIA_RPC_URL` en .env | Default `https://sepolia.base.org`, overridable. | ✓ |
| Hardcoded público | Literal URL in code. | |

### Q4: ¿Tx hash observability?

| Option | Description | Selected |
|--------|-------------|----------|
| LogBus del Operator + workflow log | `log_entry` with `txHash`+`explorerUrl` to Operator LogBus. | ✓ |
| Solo workflow log | KeeperHub-only logs. | |
| stdout + README | Manual documentation. | |

---

## Claude's Discretion

- Internal directory layout under `apps/keeperhub/src/`
- EVM client library (viem recommended; ethers acceptable)
- In-process secret-map data structure
- Retry timing tuning if KeeperHub run timeouts demand
- LogBus ingestion path shape (HTTP route vs WS publish)
- Funding ETH amount per wallet (0.001 default)
- Whether `forge script --broadcast` is wrapped in a `pnpm` script
- Solidity test depth (one happy + one revert sufficient)

## Deferred Ideas

- Production access control on FleetRegistry (Ownable / roles)
- On-chain `register(address[])` event mirror
- HD-wallet / mnemonic-based generation
- Live faucet integration in `fund_wallets`
- Round-robin / N-to-M wallet mapping
- Per-wallet deprecate transactions (vs single batched call)
- Persisted run history beyond logs
- Foundry keystore / hardware-wallet signing for deploys

---

# Reconciliation Pass — 2026-04-30

> **Trigger:** RESEARCH.md established that KeeperHub is a hosted SaaS with a fixed built-in node catalog (manual, webhook, web3, condition, math, schedule). It does NOT load user-authored TypeScript modules. The `KeeperHub/keeperhub` repo is the Workflow DevKit template, not the production runtime. The original D-05/D-06/D-07 ("native TS in-repo nodes loaded by KeeperHub") were anchored on a wrong premise.

**Areas discussed:** Workflow graph shape, Wallet generation locus, apps/keeperhub package shape, Tx-hash + signing flow

---

## Workflow graph shape

### Q1: Canonical 5-node graph

| Option | Description | Selected |
|--------|-------------|----------|
| Manual + 2 webhooks + 2 web3 | manual → webhook(generate) → web3.execute_transfer(fund) → webhook(distribute) → web3.execute_contract_call(deprecate) | ✓ |
| Schedule + 2 webhooks + 2 web3 | Same but schedule-triggered (autonomous demo runs) | |
| Manual + 1 webhook + 2 web3 + condition | Collapse generate+distribute, gate deprecate via condition node | |

### Q2: Trigger path for `run_rotation` MCP tool

| Option | Description | Selected |
|--------|-------------|----------|
| MCP → KeeperHub run API directly | MCP authenticates with KEEPERHUB_API_TOKEN, hits run-trigger endpoint | ✓ |
| MCP → Operator → KeeperHub | Operator owns the auth token, MCP forwards | |
| MCP → manual node webhook URL | POST directly to manual trigger's incoming webhook | |

### Q3: Deprecate-after-all-acks enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Operator gates (200/4xx response) | `/rotation/distribute` returns 200 only on full success; KeeperHub edge fires only on 200 | ✓ |
| Condition node in KeeperHub | Webhook returns ack list; condition node checks all=success | |
| Per-runtime fanout in graph | Parallel edges per runtimeId, aggregator before deprecate | |

---

## Wallet generation locus

### Q1: Where are EOA privkeys generated + held?

| Option | Description | Selected |
|--------|-------------|----------|
| Operator in-memory by runId | Generate in `/rotation/generate`, hold in Map, return only addresses to KeeperHub | ✓ |
| Separate vault microservice | New `apps/vault/` for cleaner OPER-05 reading | |
| `apps/keeperhub` poller process | Generation in glue package; never touches Operator | |

### Q2: Privkey TTL — when is the Map cleared?

| Option | Description | Selected |
|--------|-------------|----------|
| After deprecate confirms | `/rotation/complete` webhook fires post-deprecate, triggers eviction | ✓ |
| After all distribute acks | Clear immediately after `/rotation/distribute` returns 200 | |
| TTL-based (10min) | Time-based eviction independent of workflow signals | |

---

## apps/keeperhub package shape

### Q1: Package contents

| Option | Description | Selected |
|--------|-------------|----------|
| workflow.json + publish + poller | Glue: graph definition, publish-workflow.ts, poll-execution.ts | ✓ |
| Just workflow.json + publish | Drop poller; rely on KeeperHub UI for tx visibility | |
| Above + webhook receiver | Add HTTP server for KeeperHub callbacks | |

### Q2: `.env` contents

| Option | Description | Selected |
|--------|-------------|----------|
| KEEPERHUB_API_TOKEN + OPERATOR_BASE_URL | Just the SaaS token + Operator URL | ✓ |
| Above + DEPLOYER_PRIVKEY | Keep deploy key here; funding stays on Turnkey | |
| Above + DEPLOYER + FUNDING | Fall back to our own funding wallet if Turnkey friction | |

---

## Tx-hash + signing flow

### Q1: FleetRegistry deploy signer

| Option | Description | Selected |
|--------|-------------|----------|
| `contracts/.env` with DEPLOYER_PRIVKEY | Foundry-driven deploy; contracts/.env separate from apps/keeperhub | ✓ |
| Manual deploy + commit address | One-shot forge run with env prompt; result in deployments/base-sepolia.json | |
| KeeperHub web3 node deploys | One-time deploy workflow using Turnkey | |

### Q2: Fund + deprecate signer

| Option | Description | Selected |
|--------|-------------|----------|
| KeeperHub Turnkey wallet | Built-in signing, pre-funded via dashboard | ✓ |
| BYO wallet via Turnkey policy | External Turnkey policy we control | |
| Webhook back to Operator with FUNDING_PRIVKEY | Operator signs; reintroduces chain key on Operator | |

### Q3: Tx-hash → LogBus path

| Option | Description | Selected |
|--------|-------------|----------|
| Poller polls run + forwards | poll-execution.ts polls KeeperHub, POSTs LogEntryMsg to Operator | ✓ |
| Web3 node → webhook → Operator | Add webhook node after each web3 node to push tx hash | |
| KeeperHub UI only, no LogBus mirror | Drop unified LogBus story; link Phase 6 UI to KeeperHub run page | |

---

## Decisions Updated/Added (see CONTEXT.md for canonical wording)

- D-05: REPLACED — workflow is hosted graph in KeeperHub using built-in nodes
- D-06: REVISED — apps/keeperhub is glue package (workflow.json + publish + poller)
- D-07: REPLACED — privkeys live in Operator memory, KeeperHub never sees them
- D-08: REVISED — run_rotation calls KeeperHub run API directly with KEEPERHUB_API_TOKEN
- D-10: REVISED — distribute is a webhook to `/rotation/distribute`; Operator does fanout
- D-11: REVISED — 409 retry lives in `/rotation/distribute`, not in workflow node
- D-12: KEPT (intent) — gating now via Operator 200/4xx response code
- D-13: REPLACED — `apps/keeperhub/.env` holds only KEEPERHUB_API_TOKEN + OPERATOR_BASE_URL
- D-14: REPLACED — KeeperHub Turnkey signs fund_wallets (pre-funded via dashboard)
- D-15: REVISED — RPC URL is in `contracts/.env` and KeeperHub web3 node config, not apps/keeperhub
- D-16: REVISED — poll-execution.ts forwards tx hashes from KeeperHub run state to Operator LogBus
- D-17: KEPT, marked SATISFIED — research mandate met by RESEARCH.md
- D-18: NEW — three new Operator routes: `/rotation/generate`, `/rotation/distribute`, `/rotation/complete`
- D-19: NEW — privkey TTL: cleared on `/rotation/complete`, 10min sweeper as safety net
- D-20: NEW — poller registration handoff from `run_rotation` to `poll-execution.ts`

Carried forward unchanged: D-01..D-04 (FleetRegistry contract surface, Foundry tooling, contract dir, deployments JSON), D-09 (1:1 wallet→runtime mapping by index).

## Deferred Ideas (added this pass)

- Self-hosted KeeperHub / Workflow DevKit deployment
- BYO Turnkey policy / external signer integration
- MCP-to-MCP integration with KeeperHub (currently HTTP)

---

# Reconciliation Pass 2 — 2026-05-01 (Live verification, M-06 closure)

> **Trigger:** Live end-to-end run against the production KeeperHub workflow (id `zu25iauu5jkv2bw9xngnl`) on Base Sepolia, exposed via `cloudflared tunnel --url http://localhost:8787`. Six divergences from documented assumptions surfaced and were fixed during the session. This pass anchors the verified runtime contract for any future re-publish or fork.

## Findings vs original assumptions

### Finding 1 — KeeperHub template syntax is `{{@<nodeId>:<NodeLabel>.data.<field>}}`, not `{{ env.X }}` or `{{ node1.X }}`

The 05-04 plan and the workflow.json shipped from the M-05 dump used three template forms that **never resolve server-side**:

- `{{ env.OPERATOR_BASE_URL }}` — KeeperHub does not support workflow-level env vars (confirmed by KeeperHub staff during this session). All env refs ship literal to the runtime.
- `{{ node1.wallets[0].address }}` — placeholder shorthand assumed by the 05-04 schema; never resolved by the production runtime.
- `{{ item.address }}` — assumed `forEach` iteration variable; resolves to a literal string and crashes the dashboard UI with `i.trim is not a function` on the `recipientAddress` input control.

The actual canonical syntax (verified against `docs.keeperhub.com/plugins/web3` examples + the workflow export the user produced after configuring fields via the visual ref-picker):

```
{{@<nodeId>:<NodeLabel>.data.<field>[index].<subfield>}}
```

Note `data.` is prepended to the response body of webhook nodes — `Webhook.data.wallets[0].address`, not `Webhook.wallets[0].address`.

### Finding 2 — `web3/write-contract.functionArgs` requires `{{@}}` templates inside the JSON-string

The user's UI-edited export shipped `functionArgs: "[[\"Webhook.data.wallets[0].address\"]]"` — bare dot-paths without `{{@}}` wrappers. KeeperHub passes those literally to ethers v6, which then attempts ENS resolution of the string `"Webhook.data.wallets[0].address"` and fails with `code=UNSUPPORTED_OPERATION` on Base Sepolia.

The working form is `[["{{@py93u03noJDAnLHTF7dNU:Webhook.data.wallets[0].address}}"]]` — the dot-paths ONLY work inside `{{@}}`.

### Finding 3 — `web3/write-contract.abi` must be a JSON-encoded **string**, not a JSON array

`prepareWorkflow.ts` was injecting `DEPRECATE_ABI` as an array constant. KeeperHub's runtime serializes that field with `String(value)` somewhere internally → `"[object Object]"` → "Invalid ABI JSON" at call time. The user's exported workflow had `abi` as `"[{...}]\n"` (JSON-string with trailing newline). Fix: `cfg.abi = JSON.stringify(DEPRECATE_ABI)` in publish-workflow's prepare step.

### Finding 4 — `network` is a **string** chain-id, not a number or label

The dashboard normalizes the network field to `"84532"` (Base Sepolia chain-id as string). Both `"Base Sepolia"` (label) and `84532` (number) get accepted by the API but emit warning paths or get silently coerced — the Transfer node showed `network: 84532` while Write Contract showed `network: "Base Sepolia"` until both were forced to `"84532"`. Standardize on string form in workflow.json.

### Finding 5 — Default `Content-Type` on HTTP webhook is `text/plain`

The node5 (log-ingest) webhook had only `Authorization` in `httpHeaders`. KeeperHub then sent the body with `Content-Type: text/plain;charset=UTF-8`. Express's `json()` body-parser silently leaves `req.body` as `undefined` for non-application/json content types → operator route returned 400 invalid_request. Fix: every webhook node MUST include `"Content-Type": "application/json"` in headers.

### Finding 6 — `KEEPERHUB_WEBHOOK_SECRET` is also a non-resolving env-template

For the same reason as Finding 1, `Authorization: Bearer {{ env.KEEPERHUB_WEBHOOK_SECRET }}` ships literally. Hardcoded `Bearer dev-secret` in workflow.json. Acceptable for demo (dev secret); production scope deferred per D-01 access-control note.

### Findings as code paths

| Finding | Fix landed in |
|---|---|
| 1 (template syntax) | `apps/keeperhub/workflow.json` — all refs rewritten to `{{@nodeId:Label.data.field}}` form |
| 1 (env vars don't resolve) | `apps/keeperhub/workflow.json` — `OPERATOR_BASE_URL` and `KEEPERHUB_WEBHOOK_SECRET` hardcoded |
| 2 (functionArgs) | `apps/keeperhub/workflow.json` node4 — `[[\"{{@...:Webhook.data.wallets[0].address}}\"]]` |
| 3 (abi as string) | `apps/keeperhub/src/prepareWorkflow.ts` — `cfg.abi = JSON.stringify(DEPRECATE_ABI)` |
| 4 (network string) | `apps/keeperhub/workflow.json` — `"network": "84532"` on both web3 nodes |
| 5 (Content-Type) | `apps/keeperhub/workflow.json` node5 httpHeaders |

Plus the operator-side companions:

- **`/rotation/generate` made idempotent** (`apps/operator/src/http/routes/rotation/generate.ts`) — KeeperHub workflow retries on transient downstream failure replay the same trigger.runId. Returning 409 broke retries; we now return 200 + same wallets if the runId already exists.
- **`/rotation/log-ingest` accepts both shapes** (`apps/operator/src/http/routes/rotation/log-ingest.ts`) — the local poller pushes `LogEntryMsg`, the workflow webhook pushes `{runId, events:[{kind, txHash|txHashes}]}`. Route now extracts hashes via regex from either and emits one log entry per hash.
- **`apps/keeperhub/src/poll-execution.ts`** URL fixed: `/api/runs/{id}` (404 every poll, never worked) → `GET /api/workflows/executions/{id}/logs` (correct per `docs.keeperhub.com/api/executions`). New shape `{execution:{status}, logs:[{nodeId, output:{tx_hash}}]}` handled.
- **`apps/operator/src/http/middleware/requestLog.ts`** (new) — logs `http_in`/`http_out` per request + captures `req.rawBody` on body-parse failure. Critical for diagnosing the Content-Type and JSON-shape issues above.
- **`apps/operator/src/http/middleware/json.ts`** — body-parser `verify` callback preserves `req.rawBody` for the error log.
- **`apps/mcp/src/index.ts`** — adds `dotenv` load at process start (relative to the file, not cwd, since Claude Code spawns the MCP from arbitrary cwd). Pre-fix the MCP server never saw `KEEPERHUB_API_TOKEN` even though `apps/mcp/.env` was correct.

## Evidence

- **First successful end-to-end runId:** `lljzfpcnxp333qpcxopso` (operator log shows `/rotation/generate 200`, `/rotation/distribute 200`, runtime `alpha` advanced `registered → received` per `mcp__sonar__list_runtimes`).
- **First end-to-end with log-ingest 200 (after Content-Type fix):** `bb2kx7y6d06s9gkczwt6p`.
- **On-chain artifacts:** the Turnkey wallet `0xb60DDB2285500e4635A7E959Eef26016D7547908` emitted real `transfer-funds` and `deprecate(address[])` txs on Base Sepolia (chain-id 84532). Tx hashes are surfaced via `/rotation/log-ingest` events into LogBus (`tx_sent:fund_tx:...`, `tx_sent:deprecate_tx:...`) with `https://sepolia.basescan.org/tx/0x…` explorer URLs.
- **Tunnel:** `cloudflared tunnel --url http://localhost:8787` (account-less Quick Tunnel) — URL `https://showcase-group-suspended-mode.trycloudflare.com` for the session. Acceptable for demo; ngrok/dedicated cloudflared tunnel recommended for the actual ETHGlobal recording per Phase 7.

## Decisions emerging from this pass

- **D-22 (NEW):** Workflow.json is **canonical for KeeperHub**, but its shape is fragile across PATCH operations. KeeperHub's `PATCH /api/workflows/{id}` is partial-update — `amount`, `httpBody`, and address-typed fields sometimes silently ignore changes when an integration is bound. Always GET-after-PATCH and visually diff. Document the specific fields known to ignore PATCH (`amount` historically ignored; `httpBody` updated reliably after the second republish).
- **D-23 (NEW):** Quick Tunnel is acceptable for live verification but the URL is ephemeral. Phase 7 demo recording must either (a) use a stable cloudflared named tunnel with custom domain, or (b) bake a fresh URL into workflow.json + republish at recording start.
- **D-24 (NEW):** `runtimeIds` is hardcoded `["alpha"]` in node1 (generate) and node3 (distribute) httpBody for the demo. `{{ trigger.runtimeIds }}` substitution does not resolve to a JSON-array form (substitutes as bare `alpha` → JSON parse fail at position 48). Multi-runtime support requires either KeeperHub fixing array-trigger substitution OR a workflow that builds one node-set per runtime ID.
- **D-25 (NEW):** On-chain `deprecate` semantics — the workflow currently passes the **NEW** wallet addresses (from generate response) to `FleetRegistry.deprecate()`. This is technically inverted vs the README narrative ("deprecate old wallets"), but the operator's Registry does not track per-runtime current wallet addresses, so the "old wallets" set is unavailable from the trigger context. Documented as known gap for v2 (see SUMMARY note); does not block submission since the contract's `WalletsDeprecated` event fires with valid EVM addresses + timestamp regardless.
- **D-26 (NEW):** Runtime self-check (`isDeprecated(myAddress)` before signing) is an obvious v2 upgrade path that turns deprecate from passive announcement into an actual security guardrail. Logged for SUBMISSION writeup ("future work").

## Carried forward unchanged

D-01 through D-21 — all decisions from the original two passes survive. The 05-04 / 05-05 plan was structurally correct; only the **template-resolution boundary between repo-side and KeeperHub-side** required reconciliation.


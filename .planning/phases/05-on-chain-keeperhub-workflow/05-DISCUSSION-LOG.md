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

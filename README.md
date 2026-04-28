# Sonar

> LLM-driven credential rotation across autonomous runtimes, with cryptographic identity verification at the last mile.

Sonar is an agent that orchestrates rotation of credentials (private keys, API keys, secrets) across a fleet of autonomous runtimes (trading bots, indexers, automations). Before delivering a fresh credential, Sonar verifies the receiver's identity cryptographically — so a clone of a runtime's binary cannot intercept rotated keys.

**Core property:** the LLM never sees the private key by construction (OWASP LLM06), and identity is bound to a per-runtime Ed25519 keypair generated in-memory at boot.

Built for **ETHGlobal OpenAgents** — track *Best Use of KeeperHub* (deadline 2026-05-03).

---

## Why

Existing rotation tooling fails the clone-attack threat model:

- **Vault / AWS Secrets Manager** — auth via transferable tokens. A cloned runtime carrying the same token passes.
- **Privy / Turnkey** — custodial. The provider sees the secret.
- **Manual SSH** — does not scale to a fleet.

Sonar's last-mile Ed25519 challenge/response binds delivery to a keypair that lives only in the legitimate runtime's memory. A clone cannot answer the challenge.

---

## Architecture

```
Claude Desktop ──MCP──▶ Sonar MCP server ──▶ Operator backend ──▶ KeeperHub workflow
                                                  │                  │
                                                  │                  ├─ generate_wallets
                                                  │                  ├─ fund_wallets
                                                  │                  ├─ distribute  ──┐
                                                  │                  └─ deprecate     │
                                                  ▼                                   │
                                          Ed25519 challenge/response  ◀───────────────┘
                                                  ▼
                                          Runtime (alpha/beta/gamma)
```

- **Agent** (LLM via Claude Desktop + Sonar MCP) decides and orchestrates the rotation workflow.
- **KeeperHub** moves on-chain steps (`generate_wallets` → `fund_wallets` → `distribute` → `deprecate`) with workflow guarantees.
- **Operator backend** keeps the registry, coordinates handshakes, streams logs over WebSocket.
- **Runtime** generates an Ed25519 keypair on boot, signs the operator's challenge, decrypts the payload, reports `ready`.
- **FleetRegistry** Solidity contract on Base Sepolia records deprecation on-chain (`WalletsDeprecated` event).
- **Identity layer** uses Ed25519 challenge/response today, with an explicit upgrade path to Foja (ZK identity) post-hackathon.

The LLM and Operator are bounded by construction — the private key only exists between KeeperHub's encrypted delivery and the verified runtime's memory.

---

## Repository Layout

```
sonar/
├── apps/
│   ├── landing/      # Public landing site (Vite + R3F sonar hero) — live
│   ├── operator/     # Operator backend (Express + WS, registry, handshake coordinator)
│   ├── runtime/      # Runtime client (Ed25519 keypair, decrypt, report ready)
│   ├── mcp/          # Sonar MCP server for Claude Desktop
│   ├── demo-ui/      # React demo UI (chat mirror + log stream + runtime panels)
│   └── contract/     # FleetRegistry Solidity contract (Base Sepolia)
├── packages/
│   └── shared/       # ITransport interface + shared message types
└── .planning/        # GSD planning artifacts (PROJECT, ROADMAP, STATE, phases)
```

---

## Quickstart

**Requirements:** Node 20+, pnpm 9+.

```bash
pnpm install
pnpm typecheck
```

### Landing site

```bash
pnpm dev          # http://localhost:5173
pnpm build        # production bundle
pnpm test         # unit + a11y
pnpm lhci         # local Lighthouse gate
```

Live: https://sonar-henna.vercel.app/

### Operator + Runtime fleet (local handshake)

```bash
pnpm dev:operator        # boots operator on its WS + HTTP control plane
# in another shell, from apps/runtime, boot one or more runtimes
```

A `fleet-smoke.sh` script runs the end-to-end identity capstone (handshake happy path, clone rejection, revocation).

---

## Roadmap

| # | Phase | Status |
|---|-------|--------|
| 1 | Public Landing | Complete |
| 2 | Workspace Foundation (pnpm monorepo + shared types) | Complete |
| 3 | Operator + Runtime + Identity Core (Ed25519 + WS) | Complete |
| 4 | Sonar MCP Server (Claude Desktop tools) | In progress |
| 5 | On-Chain + KeeperHub Workflow (Base Sepolia) | Pending |
| 6 | Demo UI + AXL Transport | Pending |
| 7 | Rehearsal + Submission | Pending |

Detail in [`.planning/ROADMAP.md`](./.planning/ROADMAP.md).

---

## Tech Stack

- **Language / runtime:** TypeScript, Node 20+
- **Workspace:** pnpm monorepo
- **Frontend:** Vite + React 18 (landing + demo UI), Three.js + R3F + Framer Motion (sonar hero)
- **Backend:** Express + `ws` (Operator), tweetnacl + ed2curve (Ed25519 + NaCl box)
- **Contract:** Solidity on Base Sepolia
- **Workflow:** KeeperHub (4-node rotation pipeline)
- **MCP:** Sonar MCP server for Claude Desktop integration
- **Test:** Vitest

---

## Constraints & Scope

- **Custody model:** non-custodial. Private keys never persist outside runtime memory and the encrypted KeeperHub delivery channel. Operator never persists private keys (enforced by test).
- **Chain:** Base Sepolia only (testnet). Mainnet deploy is out of scope.
- **Single-tenant demo.** No multi-tenant operator, no recovery flows for lost keys, no real trading integrations.
- **Identity:** Ed25519 challenge/response now; Foja (ZK identity) is the documented upgrade path.

Full scope and out-of-scope list: [`.planning/PROJECT.md`](./.planning/PROJECT.md).

---

## License

TBD.

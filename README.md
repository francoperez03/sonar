# Sonar

> LLM-driven credential rotation across autonomous runtimes, with cryptographic identity verification at the last mile.

Sonar is an agent that orchestrates rotation of credentials (private keys, API keys, secrets) across a fleet of autonomous runtimes — trading bots, indexers, automations. Before delivering a fresh credential, Sonar verifies the receiver's identity cryptographically, so a clone of a runtime's binary cannot intercept rotated keys.

**Core property:** the LLM never sees the private key by construction (OWASP LLM06). Identity is bound to a per-runtime Ed25519 keypair generated in-memory at boot — and verified end-to-end by an active challenge/response right before delivery.

Live landing: <https://sonar-henna.vercel.app/>

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
Claude Desktop / Demo UI ──▶ Sonar Agent (Anthropic) ──▶ Operator backend ──▶ KeeperHub workflow
                                                              │                     │
                                                              │                     ├─ generate_wallets
                                                              │                     ├─ fund_wallets
                                                              │                     ├─ distribute  ──┐
                                                              │                     └─ deprecate     │
                                                              ▼                                      │
                                                    Ed25519 challenge/response  ◀────────────────────┘
                                                              ▼
                                                  Runtime fleet (alpha / beta / gamma)
```

- **Agent** (Claude Haiku via the operator's `/agent` endpoint, or Claude Desktop via the Sonar MCP) decides and orchestrates the rotation workflow with a small, locked tool surface.
- **KeeperHub** runs the on-chain steps (`generate_wallets` → `fund_wallets` → `distribute` → `deprecate`) with workflow guarantees.
- **Operator backend** keeps the runtime registry, coordinates the handshake, and broadcasts events over WebSocket. Includes a clone-rejection gate with active socket probing to avoid false positives during runtime hot-reload.
- **Runtime** generates an Ed25519 keypair on boot (in-memory only), signs the operator's challenge, decrypts the payload (NaCl box), reports `ready`.
- **FleetRegistry** Solidity contract on Base Sepolia records deprecation on-chain (`WalletsDeprecated` event) so the timeline is auditable.
- **Demo UI** mirrors the chat with the agent, the live event stream, and a canvas with all runtimes + the rotation pipeline.

The LLM and the operator are bounded by construction: the private key only exists between KeeperHub's encrypted delivery channel and the verified runtime's memory.

---

## Repository layout

```
sonar/
├── apps/
│   ├── landing/      # Public landing site (Vite + R3F sonar hero)
│   ├── operator/     # Operator backend (Express + WS, registry, handshake coordinator, agent loop)
│   ├── runtime/      # Runtime client (Ed25519 keypair, decrypt, report ready)
│   ├── mcp/          # Sonar MCP server for Claude Desktop
│   ├── demo-ui/      # React demo (chat + log stream + canvas)
│   └── contract/     # FleetRegistry Solidity contract (Base Sepolia)
├── packages/
│   └── shared/       # ITransport interface + shared message types
├── infra/axl/        # Optional gensyn-ai/axl P2P transport scripts
└── scripts/          # AXL bridge + auxiliary scripts
```

---

## Tech stack

- **Language / runtime:** TypeScript, Node 20+
- **Workspace:** pnpm 9 monorepo
- **Frontend:** Vite + React 18, Three.js + React Three Fiber + Framer Motion (landing hero + canvas animations)
- **Backend:** Express + `ws` (operator), tweetnacl + ed2curve (Ed25519 + NaCl box)
- **Agent:** `@anthropic-ai/sdk` with Claude Haiku
- **Contract:** Solidity on Base Sepolia (Foundry)
- **Workflow:** KeeperHub (4-step rotation pipeline)
- **Test:** Vitest

---

## Quickstart

### Requirements

- Node 20+
- pnpm 9+
- An Anthropic API key (for the agent)
- A KeeperHub webhook secret (the operator refuses to boot without it)

### 1. Install

```bash
pnpm install
pnpm typecheck
```

### 2. Environment

Operator (`apps/operator/.env.local` or exported in your shell):

```bash
ANTHROPIC_API_KEY=sk-ant-...
KEEPERHUB_WEBHOOK_SECRET=...   # required
KEEPERHUB_API_TOKEN=...        # optional — needed to actually call KeeperHub
KEEPERHUB_WORKFLOW_ID=...      # optional — same
OPERATOR_HTTP_PORT=8787        # default
REGISTRY_PATH=apps/operator/data/registry.json   # default
```

Demo UI (`apps/demo-ui/.env.local`):

```bash
VITE_OPERATOR_WS_URL=ws://localhost:8787/logs
# Optional — only set if you have the AXL bridge running:
# VITE_AXL_BRIDGE_URL=ws://localhost:9001
# VITE_AXL_DEST_PEER_ID=...
```

Runtimes only need `RUNTIME_ID=alpha` (or `beta` / `gamma`) when launched manually — the helper scripts below set this for you.

### 3. Run the local fleet

The most useful command — boots the operator, three runtimes (`alpha`, `beta`, `gamma`), and the demo UI in one go:

```bash
pnpm dev:fleet+ui
```

Then open <http://localhost:5173>. You should see the canvas with four cards (alpha, beta, gamma, alpha-clone) and live `LIVE` connection status in the topbar.

### 4. Drive a rotation from the agent

In the demo UI's chat, ask the agent:

```
list runtimes
rotate keys for alpha and beta
simulate clone attack against alpha
revoke gamma
reset demo
```

The agent will route each prompt to one of its six locked tools (`list_runtimes`, `revoke`, `run_rotation`, `get_workflow_log`, `simulate_clone_attack`, `reset_demo`) and you'll see the corresponding events flow through the canvas.

### Other useful scripts

```bash
pnpm dev                 # landing site only (http://localhost:5173)
pnpm dev:operator        # just the operator backend
pnpm dev:fleet           # three runtimes (no operator, no UI)
pnpm dev:axl             # full fleet+ui plus the gensyn-ai/axl P2P bridge
pnpm build               # production build of every package
pnpm test                # all unit tests in parallel
pnpm test:e2e            # landing E2E
pnpm format              # prettier write
```

### On-chain (optional)

The FleetRegistry contract lives in `contracts/`. To redeploy on Base Sepolia:

```bash
DEPLOYER_PRIVKEY=0x... pnpm deploy:contracts
```

For a dry run with the well-known Anvil test key:

```bash
pnpm deploy:contracts:dry
```

---

## Connecting Claude Desktop (via the MCP server)

The Sonar MCP server (`apps/mcp/`) exposes the operator's tools to Claude Desktop so you can drive rotations from there instead of the demo UI's chat. Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sonar": {
      "command": "pnpm",
      "args": ["--silent", "--filter", "@sonar/mcp", "start"],
      "cwd": "/absolute/path/to/sonar",
      "env": {
        "KEEPERHUB_WEBHOOK_SECRET": "...",
        "KEEPERHUB_API_TOKEN": "...",
        "KEEPERHUB_WORKFLOW_ID": "..."
      }
    }
  }
}
```

Restart Claude Desktop. The Sonar tools should appear in the tool picker.

---

## License

TBD.

# @sonar/keeperhub

Glue between Sonar's Operator and the KeeperHub-hosted rotation workflow:

- `src/publish-workflow.ts` — one-shot script that uploads `workflow.json` to KeeperHub.
- `src/poll-execution.ts` — long-lived poller that mirrors KeeperHub run state into the Operator's LogBus.
- `src/runRegistry.ts` — in-process Set of active KeeperHub runIds (Plan 05's `run_rotation` MCP tool registers each new runId here).

## Manual operations index

This package surfaces every manual operation in `.planning/phases/05-on-chain-keeperhub-workflow/05-MANUAL-OPS.md`. Each MANUAL-OPS ID is referenced by name below so the Phase 7 demo-script verification step can grep against this README.

### One-time setup

- **M-01** — Sign up at `app.keeperhub.com`, create an API key. Set `KEEPERHUB_API_TOKEN` in `apps/keeperhub/.env`.
- **M-02** — Create a Turnkey wallet on KeeperHub for Base Sepolia and grant it workflow-invoke permission. Used by the `web3/transfer-funds` and `web3/write-contract` nodes in `workflow.json`.
- **M-03** — Fund the Turnkey wallet via a Base Sepolia faucet (≥ 0.01 ETH). Covers `transfer-funds × N runtimes + deprecate × 1 + buffer`. Faucet sources: Coinbase / Alchemy / QuickNode public faucets.
- **M-04** — (Plan 02) deploy `FleetRegistry` to Base Sepolia and commit `deployments/base-sepolia.json`. `publish-workflow` reads the deployed address from this file.
- **M-05** — Build the rotation workflow in the KeeperHub UI (manual trigger → webhook(generate) → web3/transfer-funds → webhook(distribute) → web3/write-contract → webhook(log-ingest)). Save it. Dump via `get_workflow` MCP or `GET /api/workflows/{id}`. Commit the JSON as `apps/keeperhub/workflow.json`.
- **M-06** — First publish:
  ```bash
  set -a; source apps/keeperhub/.env; set +a
  pnpm --filter @sonar/keeperhub publish:workflow
  ```
  Copy the printed `workflowId` into `apps/keeperhub/.env` as `KEEPERHUB_WORKFLOW_ID`. Subsequent runs PUT to `/api/workflows/{id}` (update) instead of POSTing (create).

### Per-rehearsal cycle (Phase 7 demo prep)

- **M-07** — Boot the runtime fleet locally:
  ```bash
  pnpm --filter @sonar/operator dev   # terminal 1
  pnpm --filter @sonar/keeperhub start # terminal 2 (poller)
  pnpm dev:fleet                       # terminal 3 (4 runtimes)
  ```
- **M-08** — Refresh Claude Desktop's `claude_desktop_config.json` if `KEEPERHUB_WORKFLOW_ID` changed (Plan 05 wires the `run_rotation` MCP tool against this env var).
- **M-09** — Re-fund threshold check before recording: confirm the Turnkey wallet has ≥ 0.005 ETH via `cast balance --rpc-url $BASE_SEPOLIA_RPC_URL <wallet-address>`.

### Submission readiness

- **M-10** — `deployments/base-sepolia.json` is committed (handled in Plan 02; verified at every `publish-workflow` run via the contract-address check).
- **M-11** — Workflow naming/visibility: confirm the KeeperHub workflow is named `Sonar rotation` and has a description suitable for ETHGlobal submission visibility.

## Environment

See `.env.example`. Required:

| Var | Required | Purpose |
|-----|----------|---------|
| `KEEPERHUB_API_TOKEN` | yes | Long-lived KeeperHub API token (M-01). |
| `KEEPERHUB_WEBHOOK_SECRET` | yes | Bearer secret on every Operator `/rotation/*` call. MUST match the Operator's value AND the workflow.json webhook nodes' Authorization header. No fallback (D-18 / B-02). |
| `KEEPERHUB_BASE_URL` | no (default `https://app.keeperhub.com`) | Override only for regional/staging endpoints. |
| `KEEPERHUB_WORKFLOW_ID` | no (set after M-06) | When unset, `publish:workflow` POSTs (creates); when set, it PUTs (updates). |
| `OPERATOR_BASE_URL` | no (default `http://localhost:8787`) | Where the poller forwards LogEntryMsgs and `/rotation/complete`. |
| `POLL_INTERVAL_MS` | no (default 3000) | Run-status poll interval — within KeeperHub's documented poll-rate ceiling. |

## Scripts

| Script | Behaviour |
|--------|-----------|
| `pnpm --filter @sonar/keeperhub build` | TypeScript compile to `dist/`. |
| `pnpm --filter @sonar/keeperhub typecheck` | `tsc --noEmit`. |
| `pnpm --filter @sonar/keeperhub test:run` | Vitest run, fake HTTP servers — no live network calls. |
| `pnpm --filter @sonar/keeperhub publish:workflow` | Uploads `workflow.json` to KeeperHub. POST on first run, PUT thereafter. |
| `pnpm --filter @sonar/keeperhub start` | Boots the long-lived poller. Operator must already be running. |

## Threat-model boundary

This package never sees a plaintext private key — by construction (OPER-05). The `web3/*` nodes in `workflow.json` are signed by KeeperHub's Turnkey wallet (M-02). The `/rotation/generate` Operator route returns only public addresses. `grep -r privkey apps/keeperhub/src/` returns no matches.

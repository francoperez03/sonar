# Phase 5 — Manual Operations Inventory

**Captured:** 2026-04-29
**Status:** Input for `/gsd-discuss-phase 5` reconciliation and downstream planning.

> **Closure note (2026-05-01):** All M-01..M-11 items are CLOSED. M-06 was the last gate; closed by an end-to-end live rotation run (`runId=lljzfpcnxp333qpcxopso`, then a clean re-run `bb2kx7y6d06s9gkczwt6p` after the log-ingest Content-Type fix). See 05-DISCUSSION-LOG.md "Reconciliation Pass 2" for findings + fixes that emerged during this verification.

Every step here is a human-only action — no script can do it autonomously. The plan MUST surface each as either (a) a `[BLOCKING]` setup task with `autonomous: false`, or (b) a documented prerequisite in the phase README before any automated task runs.

---

## One-time account / dashboard setup

### M-01 — KeeperHub account + API key
- Sign up at `app.keeperhub.com`.
- Generate a personal API key from account settings.
- Store as `KEEPERHUB_API_KEY` in `apps/keeperhub/.env` (gitignored) and in the Sonar MCP server `.env` (so `run_rotation` can call `execute_workflow`).
- `.env.example` MUST list this var with a comment pointing to the dashboard.

### M-02 — KeeperHub Turnkey wallet creation
- In the KeeperHub dashboard, create a managed Turnkey wallet for Base Sepolia.
- Record the wallet address.
- Grant the wallet permission to be invoked by the Phase 5 workflow (whatever the dashboard's permission/binding UX is at that time).
- This is the signer for both `web3` nodes (`fund_wallets`'s `execute_transfer` and `deprecate`'s `execute_contract_call`).

### M-03 — Fund the KeeperHub Turnkey wallet on Base Sepolia
- Visit a Base Sepolia faucet (Coinbase / Alchemy / QuickNode public faucet).
- Send enough Sepolia ETH to cover: per-runtime fund tx (`0.001 ETH × N runtimes` default) + one `deprecate(address[])` tx + a small buffer.
- Verify on Basescan that the balance landed before proceeding.

### M-04 — Foundry deployer EOA setup (only if NOT deploying from KeeperHub UI)
- Generate or reuse a local EOA for `FleetRegistry` deploy.
- Save privkey as `DEPLOYER_PRIVKEY` in `contracts/.env` (gitignored) — note: lives in the Foundry workspace, NOT the Operator package, so OPER-05 holds.
- Visit a Base Sepolia faucet to fund this EOA with enough Sepolia ETH for one contract deploy (~0.01 ETH safe margin).
- **Alternative:** deploy `FleetRegistry` directly from the KeeperHub Turnkey wallet via the dashboard. If that path is chosen, this step (and `DEPLOYER_PRIVKEY` entirely) drops.

---

## One-time discovery (Wave 0 spike)

### M-05 — Workflow JSON shape dump
- KeeperHub does NOT publish a JSON Schema for per-node `data.*` field names. The shape must be discovered by hand.
- Build a 4-node skeleton workflow in the KeeperHub UI: `manual` trigger → `webhook` (generate) → `web3` (transfer) → `webhook` (distribute) → `web3` (contract_call).
- Save it.
- Call `get_workflow({ id })` via the KeeperHub MCP tool (or REST `GET /api/workflows/{id}`) to dump the exact JSON.
- Port the shape into `apps/keeperhub/workflow.json` as the canonical source of truth.
- After this, all further edits are programmatic — no more dashboard authoring.

### M-06 — First `publish-workflow.ts` round-trip [DONE 2026-05-01]
- Run `pnpm --filter @sonar/keeperhub publish:workflow` once interactively.
- The script calls `create_workflow` (or `update_workflow` on subsequent runs) and prints the assigned `workflowId`.
- Copy the printed `workflowId` into `apps/keeperhub/.env` as `KEEPERHUB_WORKFLOW_ID` (the script CAN auto-persist this — planner decides).

**Status: CLOSED 2026-05-01.** `KEEPERHUB_WORKFLOW_ID = zu25iauu5jkv2bw9xngnl`. Verified via end-to-end rotation triggered from Claude (`mcp__sonar__run_rotation { runtimeIds: ["alpha"] }`) — all 5 nodes executed, Operator received `/rotation/{generate,distribute,log-ingest}` webhooks via cloudflared tunnel, Base Sepolia recorded `transfer-funds` + `deprecate(address[])` txs, runtime `alpha` advanced `registered → received`. Six divergences from plan assumptions discovered + fixed; full report in `05-DISCUSSION-LOG.md` "Reconciliation Pass 2".

---

## Per-demo / per-rehearsal manual touch-points

### M-07 — Pre-funded runtime fleet boot
- Manual: `pnpm dev:fleet` (already exists from Phase 3) before triggering a rotation.
- Verify alpha/beta/gamma are all `registered` via `list_runtimes` (Phase 4 MCP tool) before pressing the demo button.

### M-08 — Claude Desktop config refresh [DONE 2026-04-30]
- Phase 4 already adds the Sonar MCP server to Claude Desktop's `claude_desktop_config.json`.
- Phase 5 adds `run_rotation` as a NEW tool on the SAME server — Claude Desktop must be restarted (or tool list refreshed) to see the new tool.
- Also: KeeperHub MCP server entry in `claude_desktop_config.json` IF Claude Desktop is the path used to call KeeperHub directly. (Phase 5 default: `apps/mcp` calls KeeperHub REST directly, so no second MCP entry.)

**Status: CLOSED 2026-04-30** via the live Claude Desktop round-trip recorded in `04-VERIFICATION.md` (list_runtimes / revoke / get_workflow_log all fired; `run_rotation` followed in this 2026-05-01 session and works end-to-end).

### M-09 — Re-funding between demo runs
- Generated rotation wallets each receive `fund_wallets` ETH and never give it back.
- Across N rehearsal runs, the Turnkey wallet (M-02) drains by `0.001 × runtimes × runs`.
- Manual: re-fund via faucet (M-03) when balance drops below threshold. Doc a low-balance check command in the demo script.

---

## Pre-submission manual touch-points

### M-10 — `deployments/base-sepolia.json` commit
- After the first successful FleetRegistry deploy (M-04 or KeeperHub UI deploy), the deploy script writes `{ FleetRegistry: { address, deployer, blockNumber, txHash, deployedAt } }`.
- Manual: review and commit this file. It's read at runtime by `apps/keeperhub` and referenced by Phase 6 + Phase 7 docs.

### M-11 — Submission-time KeeperHub workflow visibility
- For *Best Use of KeeperHub* track judging, the workflow likely needs to be visible/named in the KeeperHub dashboard.
- Manual: check naming, description, and tags on the published workflow before submission. Document this as part of the Phase 7 submission checklist.

---

## Planner contract

When Phase 5 plans are authored, every M-NN above MUST map to either:
- A `[BLOCKING]` task with `autonomous: false` and acceptance criteria the human can verify (e.g., "Basescan shows non-zero balance at address X"), OR
- A line in `apps/keeperhub/README.md` (or `docs/CLAUDE-DESKTOP-SETUP.md` for Claude config) that the Phase 7 demo-script verification will exercise.

No M-NN may be silently assumed. If an item is reclassified during discuss-phase (e.g., M-04 dropped because we deploy from the KeeperHub UI), update this file and note the rationale.

---

*Captured during Phase 5 research review, 2026-04-29.*

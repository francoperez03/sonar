---
phase: 05-on-chain-keeperhub-workflow
plan: 02
status: complete
requirements: [CHAIN-01, CHAIN-02, CHAIN-03]
---

# Plan 05-02 Summary — FleetRegistry deployed + CHAIN-02 emit probe

## Outcome

FleetRegistry is live on Base Sepolia (chain id 84532). Both deploy and emit-probe transactions are confirmed on-chain. `deployments/base-sepolia.json` is committed as the canonical address record consumed by Plan 04+ and Phase 6/7.

## On-chain artifacts

| Field | Value |
|---|---|
| Address | `0x7eddfC8953A529Ce7ffb35de2030f73Aad89b31F` |
| Deployer EOA | `0xb60ddb2285500e4635a7e959eef26016d7547908` |
| Deploy tx | `0x0a7e59d5aba178cf8b191a3bfd879d87e004ec3dbc9a8e0b827ae919e50e68e7` |
| Block | 40900787 |
| CHAIN-02 probe tx | `0xace577cfe698b11a44293205c3a6b658f4c26e5b7ea75b4b306ef5a81b711ceb` |
| Bytecode size | 384 B runtime |

## Verification gates

- `cast receipt $probe --json | jq .logs[0].topics[0]` → `0xbf671f2c63c8d1e7e1fb5c35ecdc0875d25a459a1c96734a446b07bfbb52f87a`
- `cast keccak "WalletsDeprecated(address[],uint256)"` → identical → CHAIN-02 ✅
- `cast code 0x7edd…b31F` → 769 hex chars (non-empty) → W-07 post-deploy bytecode probe ✅
- `deployments/base-sepolia.json` validated: address regex + chain02ProbeTxHash regex pass

## Files written / modified

- `contracts/script/RecordDeployment.ts` (new — Task 1)
- `contracts/script/EmitProbe.s.sol` (new — Task 3)
- `contracts/package.json` (new — exposes tsx)
- `contracts/foundry.toml` (modified — fs_permissions for ../deployments)
- `package.json` (modified — `deploy:contracts` + `:dry` scripts)
- `deployments/base-sepolia.json` (new — committed source of truth)

## Deviations during broadcast (committed in fix commit)

1. **EmitProbe.s.sol path** — script originally used `deployments/base-sepolia.json` (relative to `contracts/`); foundry resolves cwd at the foundry project root, so the path had to be `../deployments/base-sepolia.json` to match `fs_permissions` and the repo layout. Fixed.
2. **RecordDeployment.ts deployer parsing** — Foundry broadcast log nests `from` under `transactions[*].transaction.from`, not `transactions[*].from`. Original code wrote `"deployer": "0x0"`. Fixed to fall back across both shapes.
3. **package.json `deploy:contracts`** — chained two `cd contracts` segments, which fails because the second `cd` runs from inside `contracts/`. Replaced second `cd contracts && tsx ...` with `pnpm exec tsx ...` (cwd already correct after first cd).

## Notes for downstream plans

- `apps/keeperhub/src/publish-workflow.ts` (Plan 04) will read `deployments/base-sepolia.json` to inject the FleetRegistry address into the `web3.contract_call` node.
- The deployer EOA (`0xb60d…7908`) is throwaway and was funded with 0.0001 ETH; ~0.000002 ETH spent on deploy, ~0.0000004 ETH on probe. Ample headroom for re-broadcasts during demo rehearsal.

## Self-Check: PASSED

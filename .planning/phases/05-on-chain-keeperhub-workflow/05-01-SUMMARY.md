---
phase: 05-on-chain-keeperhub-workflow
plan: 01
subsystem: contracts
tags: [foundry, solidity, fleet-registry, base-sepolia]
requires: []
provides:
  - "contracts/ Foundry workspace (forge build/test/script ready)"
  - "FleetRegistry.sol — deprecate(address[]) + WalletsDeprecated event"
  - "Deploy.s.sol — broadcast scaffolding (consumed by Plan 02)"
affects:
  - "Phase 5 Plan 02: invokes Deploy.s.sol via forge script --broadcast"
  - "Phase 5 Plan 04: apps/keeperhub/src/publish-workflow.ts reads deployments/base-sepolia.json (created by Plan 02)"
tech-stack:
  added: ["Foundry (forge 1.3.5)", "solc 0.8.24", "forge-std v1.16.1"]
  patterns: ["Solidity-native testing (forge-std/Test.sol + vm.expectEmit)", "env-var-scoped deploy (vm.envUint)"]
key-files:
  created:
    - "contracts/foundry.toml"
    - "contracts/.gitignore"
    - "contracts/.env.example"
    - "contracts/lib/forge-std/ (vendored, v1.16.1)"
    - "contracts/src/FleetRegistry.sol"
    - "contracts/test/FleetRegistry.t.sol"
    - "contracts/script/Deploy.s.sol"
  modified: []
decisions:
  - "Vendored forge-std as a plain directory (not a git submodule) because the worktree shares its gitdir with main, so `forge install` writes .gitmodules to the wrong repo. Equivalent reproducibility — pinned to tag v1.16.1."
metrics:
  duration_minutes: 6
  completed_date: "2026-04-30"
  task_count: 3
  file_count: 7
requirements: [CHAIN-01]
---

# Phase 5 Plan 01: Contracts Scaffold Summary

Greenfield Foundry workspace at `contracts/` with FleetRegistry compiling under solc 0.8.24, two passing happy-path forge tests, and a deploy script wired through `vm.envUint("DEPLOYER_PRIVKEY")`. Delivers CHAIN-01 ("FleetRegistry compiles") up to — but not including — actual broadcast (Plan 02 owns broadcast).

## What Was Built

| Task | Description                                      | Commit  |
| ---- | ------------------------------------------------ | ------- |
| 1    | Scaffold Foundry workspace + vendor forge-std    | 64a9b86 |
| 2 RED| Failing FleetRegistry test (expectEmit)          | 7409b7a |
| 2 GREEN| FleetRegistry.sol implementation (13 LOC)      | 8706d70 |
| 3    | Deploy.s.sol forge script + dry-run validation   | c70ab43 |

## Verification Results

- `cd contracts && forge build` — exits 0; `Compiler run successful!`
- `cd contracts && forge test` — 2/2 pass:
  - `test_Deprecate_EmitsEvent` (gas: 14184)
  - `test_Deprecate_EmptyArray_StillEmits` (gas: 12317)
- `forge build --sizes` — `FleetRegistry` runtime bytecode: **383 B** (well under the 1024 B sanity ceiling per D-01).
- `forge script script/Deploy.s.sol --sig 'run()'` (with Anvil test key, no `--broadcast`, no RPC) — exits 0 and prints `FleetRegistry deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3` (deterministic CREATE address from the well-known dev key).
- `grep -r DEPLOYER_PRIVKEY contracts/src contracts/test` — no matches (key only referenced in `script/Deploy.s.sol` via `vm.envUint`).
- `git ls-files contracts/.env` — empty (root `.gitignore` covers `.env`; `contracts/.gitignore` covers it again belt-and-suspenders).

## Forge / forge-std Provenance

- Foundry: `forge 1.3.5-stable` (commit `9979a41b5daa5da1572d973d7ac5a3dd2afc0221`).
- forge-std: tag `v1.16.1`, upstream commit `620536fa5277db4e3fd46772d5cbc1ea0696fb43`. Vendored by `git clone --depth 1 --branch v1.16.1 https://github.com/foundry-rs/forge-std lib/forge-std` then `rm -rf lib/forge-std/.git`. Files committed verbatim.

## Deviations from Plan

### 1. [Rule 3 — Blocking] forge-std vendored as plain directory, not git submodule

- **Found during:** Task 1.
- **Issue:** The plan instructed `forge install foundry-rs/forge-std --no-commit`, but (a) the `--no-commit` flag was removed in Foundry 1.x (current build is `1.3.5`), and (b) running `forge install foundry-rs/forge-std` from inside the worktree at `contracts/` resolved to the *main repo's* `lib/forge-std` (not the worktree's), because git worktrees share a single gitdir — submodule registration writes `.gitmodules` to the parent repo's index, polluting main with a top-level `lib/forge-std` entry. Plan 02's Foundry deploy and Plan 04's `publish-workflow.ts` only need forge-std headers to be importable; submodule mechanics are an implementation detail.
- **Fix:** Cleaned up the cross-worktree submodule pollution on main (removed `.gitmodules`, removed `lib/forge-std`, removed `.git/modules/lib`). Re-vendored forge-std into `contracts/lib/forge-std` via shallow clone of tag `v1.16.1`, then stripped the inner `.git` so the tree commits cleanly into the worktree's history without any submodule machinery.
- **Trade-off:** Repository size grows by ~71 files / ~29k lines (forge-std is hefty), but this matches the plan's `files_modified` listing of `contracts/lib/forge-std`. Tag pinning preserves the same auditable provenance a submodule SHA pin would give.
- **Files modified:** `contracts/lib/forge-std/` (vendored).
- **Commit:** `64a9b86`.

### 2. [Rule 3 — Blocking] `forge --no-commit` flag removed in Foundry 1.x

- **Found during:** Task 1, first `forge install` invocation.
- **Issue:** `forge install foundry-rs/forge-std --no-commit` errors with `unexpected argument '--no-commit' found`.
- **Fix:** Subsumed by Deviation 1 — switched to `git clone` instead of `forge install` entirely, sidestepping the flag question.

No other deviations. The contract surface, test shape, and script body match the plan verbatim.

## Authentication Gates

None. This plan runs entirely on a local in-memory EVM; `forge test` requires no network access and `forge script` was invoked without `--broadcast` and without an RPC URL.

## Pointer to Plan 02

`contracts/script/Deploy.s.sol` is broadcast-ready but intentionally NOT broadcast in this plan. Plan 02 will:

1. Source the human-supplied `DEPLOYER_PRIVKEY` from `contracts/.env` (M-04 in `05-MANUAL-OPS.md`).
2. Invoke `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify`.
3. Run a TS post-step that captures the deployer address, txHash, blockNumber, and contract address into `deployments/base-sepolia.json` (D-04 shape).

The address-write into a JSON file is deliberately split out of the Solidity script per CONTEXT D-04 — Solidity scripts don't write JSON cleanly, and Plan 02's TS wrapper is the right home for it.

## Self-Check: PASSED

- `contracts/foundry.toml` — FOUND
- `contracts/.gitignore` — FOUND
- `contracts/.env.example` — FOUND
- `contracts/lib/forge-std/src/Test.sol` — FOUND
- `contracts/src/FleetRegistry.sol` — FOUND
- `contracts/test/FleetRegistry.t.sol` — FOUND
- `contracts/script/Deploy.s.sol` — FOUND
- Commit `64a9b86` — FOUND
- Commit `7409b7a` — FOUND
- Commit `8706d70` — FOUND
- Commit `c70ab43` — FOUND

## TDD Gate Compliance

- RED gate: commit `7409b7a` (`test(05-01): add failing FleetRegistry test`).
- GREEN gate: commit `8706d70` (`feat(05-01): implement FleetRegistry.deprecate`).
- REFACTOR gate: skipped — implementation is already at minimum surface (13 LOC, no imports, single function, single event); no refactor target.
- Plan-level gate sequence ✅.

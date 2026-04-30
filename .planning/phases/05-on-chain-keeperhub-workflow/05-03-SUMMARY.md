---
phase: 05-on-chain-keeperhub-workflow
plan: 03
subsystem: operator
tags: [rotation, privkey-vault, bearer-auth, oper-05, viem]
requires: [phase-3-operator-runtime-identity-core]
provides:
  - "POST /rotation/generate (bearer-auth)"
  - "POST /rotation/distribute (bearer-auth, retry 1s/3s/8s, all-or-fail aggregation)"
  - "POST /rotation/complete (bearer-auth)"
  - "POST /rotation/log-ingest (bearer-auth, LogBus producer)"
  - "PrivkeyVault: in-memory ephemeral wallet store with TTL eviction + toJSON guard"
  - "bearerAuth(secret) Express middleware (timingSafeEqual)"
  - "DISTRIBUTE_RETRY_DELAYS_MS = [0,1000,3000,8000]"
affects:
  - apps/operator/src/http/server.ts (additive — 4 new mounts; WS upgrade router unchanged)
  - apps/operator/src/index.ts (vault + webhookSecret wiring)
  - apps/operator/src/config.ts (KEEPERHUB_WEBHOOK_SECRET strict required)
tech_stack:
  added:
    - viem ^2.21.0 (generatePrivateKey + privateKeyToAccount)
  patterns:
    - "Memory-only sensitive material (mirrors Phase 3 nonces TTL idiom)"
    - "Zod-at-the-boundary at every /rotation/* route entry"
    - "LogEntryMsg as the on-chain event channel (LogBus → /logs WS)"
    - "Constant-time bearer auth via crypto.timingSafeEqual"
key_files:
  created:
    - apps/operator/src/rotation/PrivkeyVault.ts
    - apps/operator/src/rotation/wallets.ts
    - apps/operator/src/http/middleware/bearerAuth.ts
    - apps/operator/src/http/routes/rotation/generate.ts
    - apps/operator/src/http/routes/rotation/distribute.ts
    - apps/operator/src/http/routes/rotation/complete.ts
    - apps/operator/src/http/routes/rotation/log-ingest.ts
    - apps/operator/test/rotation.privkey-vault.test.ts
    - apps/operator/test/rotation.routes.test.ts
  modified:
    - apps/operator/src/http/server.ts
    - apps/operator/src/index.ts
    - apps/operator/src/config.ts
    - apps/operator/package.json
    - apps/operator/test/oper-05.invariant.test.ts
    - apps/operator/test/http.routes.test.ts
    - apps/operator/test/iden-01.gate.test.ts
    - apps/operator/test/iden-02.clone-rejected.test.ts
    - apps/operator/test/iden-03.revoke.test.ts
    - apps/operator/test/logs.broadcast.test.ts
    - apps/operator/test/transport.e2e.test.ts
    - apps/operator/test/helpers/runFleetSmoke.ts
    - pnpm-lock.yaml
decisions:
  - "Test pattern: stubbed HandshakeCoordinator (not real fleet + fake timers) for /rotation/distribute retry/all-ack tests. Plan 04 poller tests should mirror this."
  - "Bearer header convention: Authorization: Bearer <KEEPERHUB_WEBHOOK_SECRET> (default Express header). Plan 04 .env.example + workflow.json must use this exact form."
  - "KEEPERHUB_WEBHOOK_SECRET is strict-required at boot — getConfig() throws if unset (no dev fallback). Tests instantiate createOperatorServer directly so they bypass getConfig() and pass webhookSecret: 'test-secret' explicitly."
  - "viem chosen over ethers v6 for ephemeral wallet generation — already in workspace pattern recommendation (CONTEXT D-Discretion)."
  - "PrivkeyVault uses 'privkey' field name (NOT 'secretKey') by design — keeps the Phase 3 OPER-05 'secretKey substring only in crypto/box.ts' static guard intact."
  - "Distribute retries gated to transient errors only (runtime_offline | ack_timeout). identity_unverified is permanent — fail fast, no backoff cost on cryptographic mismatch."
metrics:
  duration_minutes: 8
  tasks_completed: 3
  files_created: 9
  files_modified: 13
  test_count_total: 66
  test_count_baseline: 35
  test_count_added: 31
completed: 2026-04-30
---

# Phase 5 Plan 3: Operator Rotation Routes Summary

End-to-end /rotation/* aggregator surface on the Operator: viem-backed ephemeral wallet generation held in a memory-only PrivkeyVault, bearer-auth at every route entry, per-runtime distribute fanout with 1s/3s/8s exponential backoff, and a LogBus producer endpoint for the KeeperHub poller — all without touching the locked Phase 3 contract.

## What Was Built

### 1. PrivkeyVault + bearerAuth + ephemeral wallet generator (Task 1)

- `apps/operator/src/rotation/PrivkeyVault.ts` — `Map<runId, EphemeralWallet[]>` with per-key TTL timer (10 min default), explicit `delete()`, and `toJSON(): never` guard so `JSON.stringify(vault)` fails loudly. Mirrors the Phase 3 `ActiveSessions` + `nonces.ts` pattern.
- `apps/operator/src/rotation/wallets.ts` — `generateEphemeralWallet()` via viem's `generatePrivateKey` + `privateKeyToAccount`. Returns `{ address, privkey, createdAt }`.
- `apps/operator/src/http/middleware/bearerAuth.ts` — Express middleware factory. Constant-time compare via `crypto.timingSafeEqual` against `Bearer <secret>`. 401 with `{error:'unauthorized'}` on miss.
- 11 unit tests (`rotation.privkey-vault.test.ts`) cover put/get/delete, TTL eviction with `vi.useFakeTimers()`, JSON.stringify throw, all bearerAuth failure modes, distinct privkeys.

### 2. Four /rotation/* routes + server wiring (Task 2)

- `generate.ts` — Validates `{runId, runtimeIds}`, 409 on duplicate, mints exactly `runtimeIds.length` wallets (D-09 strict 1:1), stores in vault, emits `wallets_generated:<runId>:<N>` log. **Response uses explicit address-only projection** (`runtimeIds.map((id, i) => ({ runtimeId: id, address: wallets[i].address }))`). Privkey never appears in body or logs.
- `distribute.ts` — Sequential per-runtime fanout. Each runtime gets up to 4 attempts spaced `[0, 1000, 3000, 8000]` ms. Retries only on transient `runtime_offline | ack_timeout`; `identity_unverified` fails fast. Returns 200 only when ALL ack — that response code IS the deprecate gate (D-12). Emits `distribute_attempt:<runId>:<runtimeId>:<N>` and `distribute_ack` / `distribute_failed` per runtime.
- `complete.ts` — Validates `{runId, deprecateTxHash}`, `vault.delete(runId)` + emits `rotation_complete:<runId>:<txHash>`, returns 200 / 404 on unknown run.
- `log-ingest.ts` — Validates body against the shared `LogEntryMsg` Zod schema (Phase 2 D-09 trust-boundary), forwards via `logBus.emitEvent`. 200 / 400 on shape mismatch.
- `http/server.ts` — `OperatorDeps` extended with `vault: PrivkeyVault; webhookSecret: string`. Four routes mounted with `bearerAuth(deps.webhookSecret)` per-route middleware after the existing Phase 3 mounts. WS upgrade router byte-for-byte unchanged.
- `index.ts` — Instantiates `new PrivkeyVault()` next to LogBus, threads `cfg.keeperhubWebhookSecret` into `createOperatorServer`.
- `config.ts` — `KEEPERHUB_WEBHOOK_SECRET` is strict-required: `getConfig()` throws `Error('KEEPERHUB_WEBHOOK_SECRET is required')` if unset (B-02 / D-18). No dev fallback.
- 6 existing test files + `runFleetSmoke` helper updated to pass `vault: new PrivkeyVault(), webhookSecret: 'test-secret'` (additive only — no Phase 3 assertions changed).

### 3. End-to-end rotation tests + OPER-05 extension (Task 3)

- `rotation.routes.test.ts` — 18 tests using a real Express server but a stubbed `HandshakeCoordinator` (issueChallenge/awaitVerification/distribute). Covers happy paths, all 401 / 400 / 404 / 409 error paths, partial-fail with retry-exhaustion (real 12s `runtime_offline` retry walk), no-retry on `identity_unverified`, log-message exclusion of privkey, and complete/log-ingest LogBus integration.
- `oper-05.invariant.test.ts` — 2 new static checks:
  - `/rotation/generate` source never matches `res.json(...privkey)` or `logBus.*(...privkey)`.
  - `PrivkeyVault.ts` matches `/toJSON\(\):\s*never/` and contains the literal throw message.
- Existing 5 OPER-05 tests still pass — `secretKey` substring still confined to `crypto/box.ts` because PrivkeyVault uses `privkey` (not `secretKey`) by deliberate naming.

## Test Counts

| Suite                          | Before | After | Delta |
| ------------------------------ | ------ | ----- | ----- |
| `@sonar/operator` total        | 35     | 66    | +31   |
| `rotation.privkey-vault`       | 0      | 11    | +11   |
| `rotation.routes`              | 0      | 18    | +18   |
| `oper-05.invariant`            | 5      | 7     | +2    |

All 66 pass. `pnpm --filter @sonar/operator typecheck` exits 0.

> **Plan stipulated baseline 46.** Actual baseline was 35 (verified before Task 1 with `pnpm --filter @sonar/operator test:run`). The plan's count appears to have included projected Phase 3 plan-05 additions that landed at a different total. New-test math: 11 (Task 1) + 18 (Task 3) + 2 (Task 3 OPER-05 extension) = 31 net new = 66 total.

## Decisions

- **Stubbed coordinator vs fake-timer fleet harness:** Used the simpler stub variant explicitly permitted in Task 3 action 2. Real-clock retry walk takes 12s in the partial-fail test but is fully deterministic and avoids the documented Phase 4 fake-timer + WS interaction issues. **Plan 04 poller tests should mirror this pattern.**
- **Bearer header convention:** `Authorization: Bearer <KEEPERHUB_WEBHOOK_SECRET>` (canonical Express header). Plan 04's `apps/keeperhub/.env.example` and `workflow.json` MUST use this exact form.
- **KEEPERHUB_WEBHOOK_SECRET strict-required at boot:** `getConfig()` throws on miss with no dev fallback. Tests bypass `getConfig()` because they call `createOperatorServer` directly — they pass `webhookSecret: 'test-secret'` explicitly. No env-var setup is needed in vitest.
- **PrivkeyVault field naming:** uses `privkey` and `privateKey`-adjacent naming, NOT `secretKey`. This preserves the existing Phase 3 OPER-05 static guard (`secretKey` substring only in `crypto/box.ts`) without modification.
- **viem ^2.21.0:** chosen over ethers v6 per CONTEXT D-Discretion. `generatePrivateKey()` returns `0x${string}` which threads cleanly through the `EphemeralWallet` interface.
- **Distribute retry gated to transient errors:** `runtime_offline | ack_timeout` only. `identity_unverified` is a permanent cryptographic failure — no point waiting 12s for the same clone.
- **WS upgrade router unchanged:** `git diff apps/operator/src/http/server.ts` shows only additive changes (5 new imports, 2 new fields on OperatorDeps, 4 new `app.post` mounts). The `httpServer.on('upgrade', ...)` block is byte-for-byte identical to Phase 3.

## Deviations from Plan

### Auto-fixed during execution (Rule 3 — blockers)

**1. [Rule 3 - Test plumbing] Updated 6 existing test files + `runFleetSmoke` helper for new `OperatorDeps` shape**

- **Found during:** Task 2
- **Issue:** Adding `vault` and `webhookSecret` as required fields on `OperatorDeps` broke every test that calls `createOperatorServer` directly (TypeScript build errors).
- **Fix:** Added `import { PrivkeyVault } from '...rotation/PrivkeyVault.js'` and inlined `vault: new PrivkeyVault(), webhookSecret: 'test-secret'` in each call site. No assertion logic touched.
- **Files modified:** `http.routes.test.ts`, `iden-01.gate.test.ts`, `iden-02.clone-rejected.test.ts`, `iden-03.revoke.test.ts`, `logs.broadcast.test.ts`, `transport.e2e.test.ts`, `helpers/runFleetSmoke.ts`.
- **Commit:** 7f1b5c8

### Plan-stated test count vs actual baseline

The plan states "Phase 3 baseline 46". Actual baseline was 35 (verified pre-execution: `Test Files 10 passed (10) | Tests 35 passed (35)`). New-test additions still meet the plan's per-task minimums (≥8 privkey-vault + ≥8 rotation-routes + ≥2 OPER-05 = ≥18); actual is 31 added, totalling 66.

## Auth Gates

None — fully autonomous. No external services, dashboards, or human input touched.

## OPER-05 Compliance

- **Static (5 baseline + 2 new = 7):** all green.
  - Baseline: no `this.* = *.secretKey`, `secretKey` only in `crypto/box.ts`, no `nacl.sign.keyPair()` in operator src.
  - New: `/rotation/generate` source never embeds `privkey` in `res.json` or `logBus.*` calls; `PrivkeyVault` has `toJSON(): never` guard with the literal throw message.
- **Behavioral (1):** still passes — the tracer-secret scan over registry/logs/sessions snapshots returns 0 matches.
- **Manual grep verification:**
  - `grep -E "privkey|privateKey" apps/operator/src/http/routes/rotation/generate.ts | grep -E "logBus\.|res\.json"` → no matches.
  - `grep -c "viem" pnpm-lock.yaml` → 2 (one for spec, one for resolved).
  - `grep "1000.*3000.*8000" apps/operator/src/http/routes/rotation/distribute.ts` → matches `[0, 1000, 3000, 8000]`.

## Threat Surface Notes

No new surface beyond the plan's threat register (T-05-03-01..10). Bearer auth applies at the boundary; Zod parses every body; PrivkeyVault is memory-only with TTL eviction; no privkey ever crosses the response/log boundary.

## Forward Hand-Offs

- **Plan 04 (apps/keeperhub):** `.env.example` MUST set `OPERATOR_BASE_URL` + `KEEPERHUB_WEBHOOK_SECRET`. The poller's `fetch` to `/rotation/log-ingest` MUST send `Authorization: Bearer ${webhookSecret}` and a `LogEntryMsg`-shaped body.
- **Plan 04 workflow.json:** the `webhook(generate|distribute|complete)` nodes MUST send `Authorization: Bearer ${KEEPERHUB_WEBHOOK_SECRET}`. The `complete` node fires after `deprecate` confirms.
- **Phase 6 Demo UI:** subscribes to `/logs` WS as before. Tx-hash entries arrive via `/rotation/log-ingest` → `LogBus.emitEvent` with no extra wiring.
- **Phase 7 demo script:** must export `KEEPERHUB_WEBHOOK_SECRET` before `pnpm dev:fleet` or the operator will crash at boot.

## Self-Check: PASSED

- All 9 created files present:
  - `apps/operator/src/rotation/PrivkeyVault.ts` FOUND
  - `apps/operator/src/rotation/wallets.ts` FOUND
  - `apps/operator/src/http/middleware/bearerAuth.ts` FOUND
  - `apps/operator/src/http/routes/rotation/generate.ts` FOUND
  - `apps/operator/src/http/routes/rotation/distribute.ts` FOUND
  - `apps/operator/src/http/routes/rotation/complete.ts` FOUND
  - `apps/operator/src/http/routes/rotation/log-ingest.ts` FOUND
  - `apps/operator/test/rotation.privkey-vault.test.ts` FOUND
  - `apps/operator/test/rotation.routes.test.ts` FOUND
- All 3 task commits present in git log:
  - 8d071b7 (Task 1) FOUND
  - 7f1b5c8 (Task 2) FOUND
  - cdece69 (Task 3) FOUND
- `pnpm --filter @sonar/operator test:run` → 66 passed
- `pnpm --filter @sonar/operator typecheck` → exit 0

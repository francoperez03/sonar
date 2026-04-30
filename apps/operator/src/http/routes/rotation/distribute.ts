/**
 * POST /rotation/distribute — Phase 5 D-10/D-11/D-12.
 *
 * Per-runtime fanout aggregator with retry. Sequential (deterministic log ordering
 * for the demo's small fleet). Each runtime gets 1 attempt + up to 3 retries spaced
 * 1s/3s/8s on transient failures (runtime_offline | ack_timeout). Identity failures
 * are NOT retried (a clone is permanent).
 *
 * Returns 200 only when ALL runtimes ack — that response code IS the deprecate gate
 * (D-12). Any failure → 502 with per-runtime results array.
 *
 * Request:  { runId, runtimeIds }
 * Response: 200 { runId, results: [{runtimeId, status:'ack'}, ...] }
 *           502 { runId, results: [{runtimeId, status:'ack'|'failed', reason?}, ...] }
 *           404 { error: 'run_not_found' }
 *           400 { error: 'invalid_request' }
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import naclUtil from 'tweetnacl-util';
import type { LogBus } from '../../../log/LogBus.js';
import type { PrivkeyVault } from '../../../rotation/PrivkeyVault.js';
import type { HandshakeCoordinator } from '../../../handshake/HandshakeCoordinator.js';
import type { ActiveSessions } from '../../../sessions/ActiveSessions.js';

export const RotationDistributeRequest = z.object({
  runId: z.string().min(1),
  runtimeIds: z.array(z.string().min(1)).min(1),
});

/** D-11: 4 attempts total — first immediate, then retries spaced 1s/3s/8s. */
export const DISTRIBUTE_RETRY_DELAYS_MS = [0, 1000, 3000, 8000] as const;

const TRANSIENT_ERRORS = new Set(['runtime_offline', 'ack_timeout']);

interface Deps {
  vault: PrivkeyVault;
  coordinator: HandshakeCoordinator;
  logBus: LogBus;
  sessions: ActiveSessions;
}

type RuntimeResult =
  | { runtimeId: string; status: 'ack' }
  | { runtimeId: string; status: 'failed'; reason: string };

async function distributeOne(
  deps: Deps,
  runId: string,
  runtimeId: string,
  walletAddress: `0x${string}`,
  privkey: `0x${string}`,
): Promise<RuntimeResult> {
  // Build payload bytes mirroring the runtime-side decryption shape.
  // Plaintext lifetime ≈ ms, encrypted toward the runtime's pubkey by HandshakeCoordinator.
  const payloadObj = { walletAddress, privkey };
  const payloadBytes = naclUtil.decodeUTF8(JSON.stringify(payloadObj));

  let lastReason = 'unknown';
  for (let attempt = 0; attempt < DISTRIBUTE_RETRY_DELAYS_MS.length; attempt++) {
    const delay = DISTRIBUTE_RETRY_DELAYS_MS[attempt]!;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    deps.logBus.logEntry(runtimeId, 'info', `distribute_attempt:${runId}:${runtimeId}:${attempt + 1}`);
    try {
      // Phase 3 D-13: issue challenge + await verification + distribute, in the same
      // sequence as the existing /distribute route. Each retry restarts the handshake.
      deps.coordinator.issueChallenge(runtimeId);
      await deps.coordinator.awaitVerification(runtimeId);
      const result = await deps.coordinator.distribute(runtimeId, payloadBytes);
      if (result.status === 'ready') {
        deps.logBus.logEntry(runtimeId, 'info', `distribute_ack:${runId}:${runtimeId}`);
        return { runtimeId, status: 'ack' };
      }
      // Coordinator returned an explicit non-ready failure.
      lastReason = result.reason;
      if (!TRANSIENT_ERRORS.has(lastReason)) {
        // Permanent failure — do not retry.
        break;
      }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : 'unknown';
      if (!TRANSIENT_ERRORS.has(lastReason)) {
        // identity_unverified or any other non-transient failure — do not retry.
        break;
      }
      // transient — fall through to next attempt
    }
  }
  deps.logBus.logEntry(runtimeId, 'warn', `distribute_failed:${runId}:${runtimeId}:${lastReason}`);
  return { runtimeId, status: 'failed', reason: lastReason };
}

export function rotationDistributeRoute(deps: Deps) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = RotationDistributeRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { runId, runtimeIds } = parsed.data;

    const wallets = deps.vault.get(runId);
    if (!wallets) {
      res.status(404).json({ error: 'run_not_found' });
      return;
    }

    const results: RuntimeResult[] = [];
    // Sequential per D-11 commentary — small demo fleet, deterministic log ordering.
    for (let i = 0; i < runtimeIds.length; i++) {
      const runtimeId = runtimeIds[i]!;
      const wallet = wallets[i];
      if (!wallet) {
        // Caller asked to distribute to more runtimes than wallets exist for this runId.
        results.push({ runtimeId, status: 'failed', reason: 'no_wallet_for_index' });
        continue;
      }
      const result = await distributeOne(deps, runId, runtimeId, wallet.address, wallet.privkey);
      results.push(result);
    }

    const allOk = results.every((r) => r.status === 'ack');
    res.status(allOk ? 200 : 502).json({ runId, results });
  };
}

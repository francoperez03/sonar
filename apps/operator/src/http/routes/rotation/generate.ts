/**
 * POST /rotation/generate — Phase 5 D-07/D-09.
 *
 * Generates exactly runtimeIds.length ephemeral EOAs (1:1 by index, D-09),
 * stores them in the in-process PrivkeyVault keyed by runId,
 * returns ONLY the public addresses (NEVER the privkey — OPER-05).
 *
 * Request:  { runId: string, runtimeIds: string[]>=1 }
 * Response: 200 { runId, wallets: [{runtimeId, address}, ...] }
 *           400 { error: 'invalid_request' }
 *           409 { error: 'run_exists' }   // duplicate runId
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { LogBus } from '../../../log/LogBus.js';
import type { PrivkeyVault } from '../../../rotation/PrivkeyVault.js';
import { generateEphemeralWallet } from '../../../rotation/wallets.js';

export const RotationGenerateRequest = z.object({
  runId: z.string().min(1),
  runtimeIds: z.array(z.string().min(1)).min(1),
});

interface Deps {
  vault: PrivkeyVault;
  logBus: LogBus;
}

export function rotationGenerateRoute(deps: Deps) {
  return (req: Request, res: Response): void => {
    const parsed = RotationGenerateRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { runId, runtimeIds } = parsed.data;

    // Idempotent: if runId already exists, return the same wallets instead of 409.
    // KeeperHub workflow retries on transient downstream failure may replay this webhook
    // with the same trigger.runId — replying 200 lets the run progress without restart.
    const existing = deps.vault.get(runId);
    if (existing) {
      const responseWallets = runtimeIds.map((runtimeId, i) => ({
        runtimeId,
        address: existing[i]!.address,
      }));
      res.status(200).json({ runId, wallets: responseWallets });
      return;
    }

    // Generate exactly runtimeIds.length wallets (D-09 strict 1:1).
    const wallets = runtimeIds.map(() => generateEphemeralWallet());
    deps.vault.put(runId, wallets);

    // OPER-05: log message MUST NOT include any privkey substring — only count.
    deps.logBus.logEntry('-', 'info', `wallets_generated:${runId}:${wallets.length}`);

    // OPER-05: response body uses explicit address-only projection (NOT spread).
    const responseWallets = runtimeIds.map((runtimeId, i) => ({
      runtimeId,
      address: wallets[i]!.address,
    }));
    res.status(200).json({ runId, wallets: responseWallets });
  };
}

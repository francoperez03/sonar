/**
 * POST /rotation/complete — Phase 5 D-19.
 *
 * Final webhook in the workflow (after deprecate confirms). Clears the runId
 * from the PrivkeyVault and emits a terminal log entry for the audit trail.
 *
 * Request:  { runId, deprecateTxHash }
 * Response: 200 { status: 'completed' }
 *           404 { error: 'run_not_found' }
 *           400 { error: 'invalid_request' }
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { LogBus } from '../../../log/LogBus.js';
import type { PrivkeyVault } from '../../../rotation/PrivkeyVault.js';

export const RotationCompleteRequest = z.object({
  runId: z.string().min(1),
  deprecateTxHash: z.string().min(1),
});

interface Deps {
  vault: PrivkeyVault;
  logBus: LogBus;
}

export function rotationCompleteRoute(deps: Deps) {
  return (req: Request, res: Response): void => {
    const parsed = RotationCompleteRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { runId, deprecateTxHash } = parsed.data;

    if (!deps.vault.has(runId)) {
      res.status(404).json({ error: 'run_not_found' });
      return;
    }

    deps.vault.delete(runId);
    deps.logBus.logEntry('-', 'info', `rotation_complete:${runId}:${deprecateTxHash}`);
    res.status(200).json({ status: 'completed' });
  };
}

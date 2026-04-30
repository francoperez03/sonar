/**
 * POST /rotation/log-ingest — Phase 5 D-16.
 *
 * Bearer-auth'd LogBus producer endpoint. Phase 5's apps/keeperhub poll-execution.ts
 * (Plan 04) POSTs validated LogEntryMsg shapes here so on-chain tx hashes flow into
 * the existing /logs WS broadcast — Phase 6 Demo UI + Phase 4 get_workflow_log
 * subscribers see them with no extra wiring.
 *
 * Request body: LogEntryMsg (validated against shared zod schema; trust-boundary
 *               check per Phase 2 D-09).
 * Response: 200 { status: 'logged' }
 *           400 { error: 'invalid_request' }
 */
import type { Request, Response } from 'express';
import { LogEntryMsg } from '@sonar/shared';
import type { LogBus } from '../../../log/LogBus.js';

interface Deps {
  logBus: LogBus;
}

export function rotationLogIngestRoute(deps: Deps) {
  return (req: Request, res: Response): void => {
    const parsed = LogEntryMsg.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    deps.logBus.emitEvent(parsed.data);
    res.status(200).json({ status: 'logged' });
  };
}

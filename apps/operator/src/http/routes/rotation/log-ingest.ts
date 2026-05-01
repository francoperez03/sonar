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
import { z } from 'zod';
import { LogEntryMsg } from '@sonar/shared';
import type { LogBus } from '../../../log/LogBus.js';
import { log } from '../../../util/log.js';

interface Deps {
  logBus: LogBus;
}

// Workflow-bundle shape sent by the KeeperHub workflow's webhook(log-ingest) node.
// Translated into one or more LogEntryMsg events on this side.
const TxBundle = z.object({
  runId: z.string().min(1),
  events: z.array(
    z.object({
      kind: z.string().min(1),
      txHash: z.string().optional(),
      txHashes: z.union([z.string(), z.array(z.string())]).optional(),
    }),
  ),
});

const TX_HASH_RE = /0x[a-fA-F0-9]{64}/g;

function explorerUrl(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

export function rotationLogIngestRoute(deps: Deps) {
  return (req: Request, res: Response): void => {
    // Accept the existing LogEntryMsg shape (used by the local poller).
    const single = LogEntryMsg.safeParse(req.body);
    if (single.success) {
      deps.logBus.emitEvent(single.data);
      res.status(200).json({ status: 'logged' });
      return;
    }

    // Accept the workflow's bundle shape: { runId, events: [{kind, txHash|txHashes}] }
    const bundle = TxBundle.safeParse(req.body);
    if (bundle.success) {
      const { runId, events } = bundle.data;
      let count = 0;
      for (const ev of events) {
        const raw = (ev.txHash ?? '') + ' ' + (Array.isArray(ev.txHashes) ? ev.txHashes.join(' ') : ev.txHashes ?? '');
        const hashes = raw.match(TX_HASH_RE) ?? [];
        for (const hash of hashes) {
          // Tag the deprecate event with the contract event name so the demo-ui's
          // WALLETS_DEPRECATED_RE matches and the footer chip lights up.
          const tag = ev.kind === 'deprecate_tx' ? 'WalletsDeprecated' : ev.kind;
          deps.logBus.logEntry('-', 'info', `tx_sent:${ev.kind}:${tag}:${runId}:${hash}:${explorerUrl(hash)}`);
          count++;
        }
      }
      res.status(200).json({ status: 'logged', count });
      return;
    }

    const bodyStr = req.body !== undefined ? JSON.stringify(req.body) : 'undefined';
    log({
      msg: 'log_ingest_invalid',
      contentType: req.headers['content-type'],
      bodyTypeof: typeof req.body,
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
      body: bodyStr.slice(0, 500),
      singleErr: single.success ? null : String(single.error?.message ?? single.error).slice(0, 300),
      bundleErr: bundle.success ? null : String(bundle.error?.message ?? bundle.error).slice(0, 300),
    });
    res.status(400).json({ error: 'invalid_request' });
  };
}

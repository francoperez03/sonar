/**
 * Long-lived poller that mirrors KeeperHub run state into the Operator's LogBus.
 *
 * Per CONTEXT D-16: extracts `tx_hash` + node id from each KeeperHub run-status node;
 * builds an explorer URL (`https://sepolia.basescan.org/tx/{hash}`); forwards as a
 * `LogEntryMsg` to `POST {OPERATOR_BASE_URL}/rotation/log-ingest` with bearer auth
 * (`KEEPERHUB_WEBHOOK_SECRET`). Per-runId dedup so the same tx is not forwarded twice.
 *
 * Per CONTEXT D-19/D-21: when the deprecate node finishes AND the run reaches
 * `status=completed`, the poller fires `POST {OPERATOR_BASE_URL}/rotation/complete`
 * once before evicting the runId from the registry. Idempotent on the Operator side
 * (404 is logged + ignored — happens when an explicit /rotation/complete webhook on
 * the workflow already fired).
 *
 * Backoff: per-runId exponential 1s → 2s → … cap 30s on transient KeeperHub failures
 * (mirrors apps/runtime/src/transport/createClientTransport.ts).
 *
 * Module structure:
 *  - `pollOnce(runId, deps)` — pure tick logic, returns `{ done, deprecateTxHash? }`.
 *  - `mainLoop(deps, signal)` — long-running for-each-runId loop.
 *  - `if (invokedDirectly)` guard at the bottom — only when run as `node dist/poll-execution.js`.
 *
 * Plan 05 will additively wire `startPollerServer(...)` into `mainLoop` (W-04 — the
 * function is structured so the call can be inserted before the long-poll loop without
 * restructuring).
 */
import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { log } from './util/log.js';
import { runRegistry } from './runRegistry.js';
import { postLogEntry, postRotationComplete } from './logIngest.js';

interface KeeperhubNode {
  id: string;
  status?: string;
  output?: { tx_hash?: string; [k: string]: unknown };
}

interface KeeperhubRun {
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  nodes: KeeperhubNode[];
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export interface PollDeps {
  apiBaseUrl: string;
  apiToken: string;
  operatorBaseUrl: string;
  webhookSecret: string;
}

export interface PollState {
  /** runId → set of node ids whose tx_hash has already been forwarded to log-ingest. */
  seen: Map<string, Set<string>>;
  /** runId → next backoff delay (resets to BASE_BACKOFF_MS on first success). */
  backoff: Map<string, number>;
}

export function createPollState(): PollState {
  return { seen: new Map(), backoff: new Map() };
}

/** Heuristic: which node id represents the deprecate-contract write?
 * Order:
 *   1. Explicit `node.output.deprecate === true` flag (future-proof).
 *   2. Node id literally `'deprecate'` (works if the M-05 dump renames the placeholder).
 *   3. Node label/output mentions 'deprecate' or 'write-contract'.
 * Falls back to undefined — the poller will only fire /rotation/complete if it can
 * unambiguously identify a deprecate tx.
 */
function findDeprecateTx(run: KeeperhubRun): string | undefined {
  for (const n of run.nodes) {
    const tx = n.output?.tx_hash;
    if (typeof tx !== 'string' || !TX_HASH_RE.test(tx)) continue;
    if (n.id === 'deprecate') return tx;
    const flag = (n.output as { deprecate?: unknown } | undefined)?.deprecate;
    if (flag === true) return tx;
  }
  // Fallback: in the canonical 5-node graph, the LAST node with a tx_hash IS the
  // deprecate node (transfer node emits txHashes plural, write-contract emits txHash).
  // Walk backward, return the first `tx_hash` on a node whose id contains 'write' or
  // 'contract'. Otherwise undefined.
  for (let i = run.nodes.length - 1; i >= 0; i--) {
    const n = run.nodes[i]!;
    const tx = n.output?.tx_hash;
    if (typeof tx !== 'string' || !TX_HASH_RE.test(tx)) continue;
    if (/write|contract|deprecate/i.test(n.id)) return tx;
  }
  return undefined;
}

export interface PollOnceResult {
  done: boolean;
  status?: string;
  deprecateTxHash?: string;
  /** Set when a transient (5xx / network) error occurred and backoff was applied. */
  transient?: boolean;
}

/**
 * Single tick for a runId.
 * - Fetches `GET {apiBaseUrl}/api/runs/{runId}` with Bearer token.
 * - For each node with a fresh tx_hash, posts a LogEntryMsg to /rotation/log-ingest.
 * - Returns done=true once status is completed|failed.
 */
export async function pollOnce(
  runId: string,
  deps: PollDeps,
  state: PollState,
): Promise<PollOnceResult> {
  let res: Response;
  try {
    res = await fetch(`${deps.apiBaseUrl}/api/runs/${runId}`, {
      headers: { 'authorization': `Bearer ${deps.apiToken}` },
    });
  } catch (e) {
    log({ msg: 'poll_network_error', runId, err: String(e) });
    bumpBackoff(state, runId);
    return { done: false, transient: true };
  }

  if (!res.ok) {
    log({ msg: 'poll_error', runId, status: res.status });
    if (res.status >= 500) {
      bumpBackoff(state, runId);
      return { done: false, transient: true };
    }
    // 4xx: not transient (auth/path issue). Surface but don't backoff.
    return { done: false };
  }

  // Success — reset backoff for this runId.
  state.backoff.set(runId, BASE_BACKOFF_MS);

  let run: KeeperhubRun;
  try {
    run = (await res.json()) as KeeperhubRun;
  } catch (e) {
    log({ msg: 'poll_parse_error', runId, err: String(e) });
    return { done: false };
  }

  const seenForRun = state.seen.get(runId) ?? new Set<string>();
  for (const n of run.nodes ?? []) {
    const tx = n.output?.tx_hash;
    if (typeof tx !== 'string' || !TX_HASH_RE.test(tx)) continue;
    if (seenForRun.has(n.id)) continue;
    const explorerUrl = `https://sepolia.basescan.org/tx/${tx}`;
    try {
      const r = await postLogEntry(deps.operatorBaseUrl, deps.webhookSecret, {
        type: 'log_entry',
        runtimeId: '-',
        level: 'info',
        message: `tx_sent:${n.id}:${tx}:${explorerUrl}`,
        timestamp: Date.now(),
      });
      if (!r.ok) {
        log({ msg: 'log_ingest_error', runId, nodeId: n.id, status: r.status });
        // Do NOT mark seen — retry on next poll cycle.
        continue;
      }
      seenForRun.add(n.id);
    } catch (e) {
      log({ msg: 'log_ingest_throw', runId, nodeId: n.id, err: String(e) });
    }
  }
  state.seen.set(runId, seenForRun);

  const status = String(run.status);
  const done = status === 'completed' || status === 'failed';
  let deprecateTxHash: string | undefined;
  if (status === 'completed') {
    deprecateTxHash = findDeprecateTx(run);
    if (deprecateTxHash) {
      try {
        const r = await postRotationComplete(deps.operatorBaseUrl, deps.webhookSecret, {
          runId,
          deprecateTxHash,
        });
        log({ msg: 'rotation_complete_posted', runId, status: r.status, deprecateTxHash });
        // 404 is fine — the explicit on-success webhook on the workflow already fired
        // and the run was reaped on the Operator side. Idempotent path.
      } catch (e) {
        log({ msg: 'rotation_complete_throw', runId, err: String(e) });
      }
    }
  }

  if (done) {
    state.seen.delete(runId);
    state.backoff.delete(runId);
  }
  return { done, status, deprecateTxHash };
}

function bumpBackoff(state: PollState, runId: string): void {
  const cur = state.backoff.get(runId) ?? BASE_BACKOFF_MS;
  const next = Math.min(cur * 2, MAX_BACKOFF_MS);
  state.backoff.set(runId, next);
}

export interface MainLoopOptions {
  pollIntervalMs: number;
  /** Test seam: signal to break the otherwise-infinite loop. */
  shouldStop?: () => boolean;
  /** Test seam: replace setTimeout-based sleep with a deterministic delay. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Long-lived loop. For each active runId, calls pollOnce and removes done runs from
 * the registry. Sleeps `pollIntervalMs` between full ticks.
 */
export async function mainLoop(
  deps: PollDeps,
  state: PollState,
  opts: MainLoopOptions,
): Promise<void> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (;;) {
    if (opts.shouldStop?.()) return;
    for (const runId of runRegistry.active()) {
      const { done } = await pollOnce(runId, deps, state);
      if (done) runRegistry.remove(runId);
    }
    await sleep(opts.pollIntervalMs);
  }
}

// Auto-run guard.
const invokedDirectly = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const cfg = getConfig();
  const deps: PollDeps = {
    apiBaseUrl: cfg.apiBaseUrl,
    apiToken: cfg.apiToken,
    operatorBaseUrl: cfg.operatorBaseUrl,
    webhookSecret: cfg.webhookSecret,
  };
  log({ msg: 'poller_start', operatorBaseUrl: cfg.operatorBaseUrl, pollIntervalMs: cfg.pollIntervalMs });
  mainLoop(deps, createPollState(), { pollIntervalMs: cfg.pollIntervalMs }).catch((e) => {
    log({ msg: 'poller_fatal', err: String(e) });
    process.exit(1);
  });
}

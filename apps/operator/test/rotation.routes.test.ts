/**
 * End-to-end tests for the Phase 5 /rotation/* surface (Plan 05-03 Task 3).
 *
 * Approach: spin up the real Operator HTTP server with a stubbed HandshakeCoordinator
 * so we can drive happy / partial-fail / retry-exhaustion paths deterministically
 * without booting a real fleet. The plan permits this fallback (see Task 3 action 2:
 * "If this proves flaky, fall back to a non-fleet test that mocks the coordinator
 * with a stub that throws 'runtime_offline' for one runtime — simpler and deterministic.").
 *
 * This file replaces the fake-timer fleet variant; rotation.routes-SUMMARY.md (and
 * the 05-03-SUMMARY.md) records the choice so Plan 04's poller tests can mirror it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { jsonBody } from '../src/http/middleware/json.js';
import { bearerAuth } from '../src/http/middleware/bearerAuth.js';
import { rotationGenerateRoute } from '../src/http/routes/rotation/generate.js';
import { rotationDistributeRoute, DISTRIBUTE_RETRY_DELAYS_MS } from '../src/http/routes/rotation/distribute.js';
import { rotationCompleteRoute } from '../src/http/routes/rotation/complete.js';
import { rotationLogIngestRoute } from '../src/http/routes/rotation/log-ingest.js';
import { LogBus } from '../src/log/LogBus.js';
import { PrivkeyVault } from '../src/rotation/PrivkeyVault.js';
import { allocPort } from './setup.js';
import type { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';

// ─── Test scaffolding ─────────────────────────────────────────────────────────

const SECRET = 'test-secret';
const AUTH_HEADER = `Bearer ${SECRET}`;

interface StubCoordinator {
  issueChallenge: (runtimeId: string) => void;
  awaitVerification: (runtimeId: string) => Promise<void>;
  distribute: (runtimeId: string, payload: Uint8Array) => Promise<{ status: 'ready' } | { status: 'failed'; reason: string }>;
}

interface StubBehavior {
  /** Map of runtimeId → desired distribute outcome on each call. Default: always 'ready'. */
  outcomes?: Record<string, Array<'ready' | { reject: string } | { failed: string }>>;
  /** Defaults to throwing 'identity_unverified' when awaitVerification is called for an unknown runtime. */
  verificationFailures?: Set<string>;
}

function makeStubCoordinator(behavior: StubBehavior = {}): StubCoordinator {
  const callCounts = new Map<string, number>();
  return {
    issueChallenge: (_runtimeId: string) => { /* no-op stub */ },
    awaitVerification: async (runtimeId: string) => {
      if (behavior.verificationFailures?.has(runtimeId)) {
        throw new Error('identity_unverified');
      }
    },
    distribute: async (runtimeId: string, _payload: Uint8Array) => {
      const seq = behavior.outcomes?.[runtimeId];
      const i = callCounts.get(runtimeId) ?? 0;
      callCounts.set(runtimeId, i + 1);
      const outcome = seq ? seq[Math.min(i, seq.length - 1)] : 'ready';
      if (outcome === 'ready') return { status: 'ready' };
      if (outcome && typeof outcome === 'object' && 'reject' in outcome) {
        throw new Error(outcome.reject);
      }
      if (outcome && typeof outcome === 'object' && 'failed' in outcome) {
        return { status: 'failed', reason: outcome.failed };
      }
      return { status: 'ready' };
    },
  };
}

let httpServer: Server | undefined;

afterEach(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    httpServer = undefined;
  }
});

interface Harness {
  port: number;
  vault: PrivkeyVault;
  logBus: LogBus;
  coordinator: StubCoordinator;
  events: Array<LogEntryMsg | StatusChangeMsg>;
  unsubscribe: () => void;
}

async function spinUp(opts: { coordinator?: StubCoordinator } = {}): Promise<Harness> {
  const port = await allocPort();
  const vault = new PrivkeyVault();
  const logBus = new LogBus();
  const coordinator = opts.coordinator ?? makeStubCoordinator();

  const events: Array<LogEntryMsg | StatusChangeMsg> = [];
  const unsubscribe = logBus.subscribe((e) => events.push(e));

  const app = express();
  app.use(jsonBody);
  const auth = bearerAuth(SECRET);
  app.post('/rotation/generate', auth, rotationGenerateRoute({ vault, logBus }));
  app.post(
    '/rotation/distribute',
    auth,
    rotationDistributeRoute({
      vault,
      // The route only uses .issueChallenge / .awaitVerification / .distribute,
      // which the stub provides. Cast to coordinator's HandshakeCoordinator type.
      coordinator: coordinator as unknown as Parameters<typeof rotationDistributeRoute>[0]['coordinator'],
      logBus,
      sessions: {} as unknown as Parameters<typeof rotationDistributeRoute>[0]['sessions'],
    }),
  );
  app.post('/rotation/complete', auth, rotationCompleteRoute({ vault, logBus }));
  app.post('/rotation/log-ingest', auth, rotationLogIngestRoute({ logBus }));

  const srv = createHttpServer(app);
  await new Promise<void>((r) => srv.listen(port, '127.0.0.1', () => r()));
  httpServer = srv;
  return { port, vault, logBus, coordinator, events, unsubscribe };
}

function postJson(port: number, path: string, body: unknown, opts: { auth?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth !== null) headers['authorization'] = opts.auth ?? AUTH_HEADER;
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ─── /rotation/generate ───────────────────────────────────────────────────────

describe('POST /rotation/generate', () => {
  it('happy path: returns N {runtimeId, address}, vault holds privkeys, NO privkey in body', async () => {
    const { port, vault } = await spinUp();
    const res = await postJson(port, '/rotation/generate', { runId: 'r1', runtimeIds: ['a', 'b'] });
    expect(res.status).toBe(200);
    const body = await res.json() as { runId: string; wallets: Array<{ runtimeId: string; address: string }> };
    expect(body.runId).toBe('r1');
    expect(body.wallets).toHaveLength(2);
    expect(body.wallets[0]!.runtimeId).toBe('a');
    expect(body.wallets[1]!.runtimeId).toBe('b');
    expect(body.wallets[0]!.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.wallets[1]!.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.wallets[0]!.address).not.toBe(body.wallets[1]!.address);

    // OPER-05: response body MUST NOT contain the substring 'privkey' (case-insensitive)
    expect(JSON.stringify(body).toLowerCase()).not.toContain('privkey');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('private');

    expect(vault.get('r1')).toBeDefined();
    expect(vault.get('r1')!).toHaveLength(2);
  });

  it('401 on missing bearer', async () => {
    const { port, vault } = await spinUp();
    const res = await postJson(port, '/rotation/generate', { runId: 'r2', runtimeIds: ['a'] }, { auth: null });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('unauthorized');
    expect(vault.has('r2')).toBe(false);
  });

  it('401 on wrong bearer', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/generate', { runId: 'r3', runtimeIds: ['a'] }, { auth: 'Bearer wrong' });
    expect(res.status).toBe(401);
  });

  it('400 on invalid body', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/generate', { runtimeIds: [] }); // missing runId, empty list
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_request');
  });

  it('409 on duplicate runId', async () => {
    const { port } = await spinUp();
    const r1 = await postJson(port, '/rotation/generate', { runId: 'dup', runtimeIds: ['a'] });
    expect(r1.status).toBe(200);
    const r2 = await postJson(port, '/rotation/generate', { runId: 'dup', runtimeIds: ['a'] });
    expect(r2.status).toBe(409);
    const body = await r2.json() as { error: string };
    expect(body.error).toBe('run_exists');
  });

  it('emits wallets_generated log with count only (no privkey leakage)', async () => {
    const { port, events } = await spinUp();
    const res = await postJson(port, '/rotation/generate', { runId: 'log1', runtimeIds: ['a', 'b', 'c'] });
    expect(res.status).toBe(200);
    const logEntries = events.filter((e): e is LogEntryMsg => e.type === 'log_entry');
    const generated = logEntries.find((e) => e.message.startsWith('wallets_generated:'));
    expect(generated).toBeDefined();
    expect(generated!.message).toBe('wallets_generated:log1:3');
    // Ensure no log entry contains a privkey hex blob
    for (const e of logEntries) {
      expect(e.message).not.toMatch(/0x[0-9a-fA-F]{64}/);
    }
  });
});

// ─── /rotation/distribute ─────────────────────────────────────────────────────

describe('POST /rotation/distribute', () => {
  it('all-ack happy path: 200 with results array', async () => {
    const coord = makeStubCoordinator(); // default: every distribute → ready
    const { port } = await spinUp({ coordinator: coord });
    await postJson(port, '/rotation/generate', { runId: 'h1', runtimeIds: ['alpha', 'beta'] });
    const res = await postJson(port, '/rotation/distribute', { runId: 'h1', runtimeIds: ['alpha', 'beta'] });
    expect(res.status).toBe(200);
    const body = await res.json() as { runId: string; results: Array<{ runtimeId: string; status: string }> };
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r) => r.status === 'ack')).toBe(true);
  });

  it('404 when runId not in vault', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/distribute', { runId: 'missing', runtimeIds: ['a'] });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('run_not_found');
  });

  it('401 on missing bearer', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/distribute', { runId: 'x', runtimeIds: ['a'] }, { auth: null });
    expect(res.status).toBe(401);
  });

  it('partial-fail with retry exhaustion: 502, beta=failed, alpha=ack', async () => {
    // beta throws runtime_offline 4 times (1 initial + 3 retries) → fails after backoff
    // alpha succeeds immediately
    const coord = makeStubCoordinator({
      outcomes: {
        alpha: ['ready'],
        beta: [
          { reject: 'runtime_offline' },
          { reject: 'runtime_offline' },
          { reject: 'runtime_offline' },
          { reject: 'runtime_offline' },
        ],
      },
    });
    const { port, events } = await spinUp({ coordinator: coord });
    await postJson(port, '/rotation/generate', { runId: 'pf', runtimeIds: ['alpha', 'beta'] });
    const res = await postJson(port, '/rotation/distribute', { runId: 'pf', runtimeIds: ['alpha', 'beta'] });
    expect(res.status).toBe(502);
    const body = await res.json() as { runId: string; results: Array<{ runtimeId: string; status: string; reason?: string }> };
    const alpha = body.results.find((r) => r.runtimeId === 'alpha');
    const beta = body.results.find((r) => r.runtimeId === 'beta');
    expect(alpha?.status).toBe('ack');
    expect(beta?.status).toBe('failed');
    expect(beta?.reason).toBe('runtime_offline');

    // Verify retry log entries appear
    const logs = events.filter((e): e is LogEntryMsg => e.type === 'log_entry');
    const betaAttempts = logs.filter((e) => e.message.includes('distribute_attempt:pf:beta:'));
    expect(betaAttempts.length).toBe(4); // 1 + 3 retries
    const betaFailed = logs.find((e) => e.message.startsWith('distribute_failed:pf:beta:runtime_offline'));
    expect(betaFailed).toBeDefined();
  }, 20_000);

  it('does NOT retry on identity_unverified (permanent failure)', async () => {
    const coord = makeStubCoordinator({
      outcomes: { alpha: [{ reject: 'identity_unverified' }] },
    });
    const { port, events } = await spinUp({ coordinator: coord });
    await postJson(port, '/rotation/generate', { runId: 'iu', runtimeIds: ['alpha'] });
    const start = Date.now();
    const res = await postJson(port, '/rotation/distribute', { runId: 'iu', runtimeIds: ['alpha'] });
    const elapsed = Date.now() - start;
    expect(res.status).toBe(502);
    // Should fail quickly — no 1s/3s/8s wait
    expect(elapsed).toBeLessThan(800);
    const logs = events.filter((e): e is LogEntryMsg => e.type === 'log_entry');
    const attempts = logs.filter((e) => e.message.startsWith('distribute_attempt:iu:alpha:'));
    expect(attempts.length).toBe(1); // single attempt only
  });

  it('exposes [0,1000,3000,8000] retry sequence (D-11 timing contract)', () => {
    expect([...DISTRIBUTE_RETRY_DELAYS_MS]).toEqual([0, 1000, 3000, 8000]);
  });
});

// ─── /rotation/complete ───────────────────────────────────────────────────────

describe('POST /rotation/complete', () => {
  it('clears vault entry + emits rotation_complete log', async () => {
    const { port, vault, events } = await spinUp();
    await postJson(port, '/rotation/generate', { runId: 'c1', runtimeIds: ['a'] });
    expect(vault.has('c1')).toBe(true);
    const res = await postJson(port, '/rotation/complete', { runId: 'c1', deprecateTxHash: '0xdeadbeef' });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('completed');
    expect(vault.has('c1')).toBe(false);

    const completeLogs = events.filter((e): e is LogEntryMsg => e.type === 'log_entry' && e.message.startsWith('rotation_complete:'));
    expect(completeLogs).toHaveLength(1);
    expect(completeLogs[0]!.message).toBe('rotation_complete:c1:0xdeadbeef');
  });

  it('404 when runId never existed', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/complete', { runId: 'never', deprecateTxHash: '0x1' });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('run_not_found');
  });

  it('401 on missing bearer', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/complete', { runId: 'x', deprecateTxHash: '0x1' }, { auth: null });
    expect(res.status).toBe(401);
  });
});

// ─── /rotation/log-ingest ─────────────────────────────────────────────────────

describe('POST /rotation/log-ingest', () => {
  it('forwards a valid LogEntryMsg through LogBus', async () => {
    const { port, events } = await spinUp();
    const evt: LogEntryMsg = {
      type: 'log_entry',
      runtimeId: '-',
      level: 'info',
      message: 'tx_sent:fund_wallets:0xabc:https://sepolia.basescan.org/tx/0xabc',
      timestamp: Date.now(),
    };
    const res = await postJson(port, '/rotation/log-ingest', evt);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('logged');
    const ingested = events.find((e) => e.type === 'log_entry' && e.message === evt.message);
    expect(ingested).toBeDefined();
  });

  it('400 on invalid shape', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/log-ingest', { foo: 'bar' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_request');
  });

  it('401 on missing bearer', async () => {
    const { port } = await spinUp();
    const res = await postJson(port, '/rotation/log-ingest', { type: 'log_entry', runtimeId: '-', level: 'info', message: 'x', timestamp: 1 }, { auth: null });
    expect(res.status).toBe(401);
  });
});

/**
 * IDEN-03 revocation tests (Plan 03-05, Task 2).
 *
 * Asserts revocation lifecycle:
 *   1. POST /revoke flips status + closes session (WS 4401) + /logs events
 *   2. Re-register after revoke is rejected (WS 4403) + log_entry register_rejected_revoked
 *   3. Revoke nonexistent id is 200 (idempotent, per plan default)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { once } from 'node:events';
import WebSocket from 'ws';
import type { Server } from 'node:http';
import { allocPort, tempRegistryPath } from './setup.js';
import { freshKeypair } from './helpers/freshKeypair.js';
import { connectRuntime } from './helpers/mockSocket.js';
import { Registry } from '../src/registry/Registry.js';
import { ActiveSessions } from '../src/sessions/ActiveSessions.js';
import { LogBus } from '../src/log/LogBus.js';
import { HandshakeCoordinator } from '../src/handshake/HandshakeCoordinator.js';
import * as nonces from '../src/handshake/nonces.js';
import { createOperatorServer } from '../src/http/server.js';
import { PrivkeyVault } from '../src/rotation/PrivkeyVault.js';
import type { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';

// ── Per-test cleanup ──────────────────────────────────────────────────────────
let httpServer: Server | undefined;
const openSockets: WebSocket[] = [];

afterEach(async () => {
  for (const ws of openSockets) {
    if (ws.readyState < 2) ws.close();
  }
  openSockets.length = 0;
  if (httpServer) {
    await new Promise<void>((r) => httpServer!.close(() => r()));
    httpServer = undefined;
  }
});

async function spinUp() {
  const port = await allocPort();
  const registry = await Registry.load(tempRegistryPath());
  const sessions = new ActiveSessions();
  const logBus = new LogBus();
  const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });
  const { httpServer: srv } = createOperatorServer({ registry, sessions, logBus, coordinator, vault: new PrivkeyVault(), webhookSecret: 'test-secret' });
  await new Promise<void>((r) => srv.listen(port, '127.0.0.1', () => r()));
  httpServer = srv;
  return { port, registry, sessions, logBus, coordinator };
}

// ── Helper: connect runtime and wait for registered ──────────────────────────
async function connectAndRegister(port: number, runtimeId: string): Promise<{ ws: WebSocket; pubkeyB64: string }> {
  const kp = freshKeypair();
  const ws = await connectRuntime(port);
  openSockets.push(ws);
  ws.send(JSON.stringify({ type: 'register', runtimeId, pubkey: kp.pubkeyB64 }));
  const [raw] = await once(ws, 'message') as [Buffer];
  const msg = JSON.parse(raw.toString()) as { type: string };
  expect(msg.type).toBe('registered');
  return { ws, pubkeyB64: kp.pubkeyB64 };
}

// ── Helper: subscribe to /logs ────────────────────────────────────────────────
async function subscribeToLogs(port: number) {
  const logsWs = new WebSocket(`ws://127.0.0.1:${port}/logs`);
  openSockets.push(logsWs);
  await once(logsWs, 'open');
  const logEntries: LogEntryMsg[] = [];
  const statusChanges: StatusChangeMsg[] = [];
  logsWs.on('message', (raw: Buffer) => {
    try {
      const e = JSON.parse(raw.toString()) as LogEntryMsg | StatusChangeMsg;
      if (e.type === 'log_entry') logEntries.push(e as LogEntryMsg);
      if (e.type === 'status_change') statusChanges.push(e as StatusChangeMsg);
    } catch { /* ignore */ }
  });
  return { logEntries, statusChanges };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('IDEN-03: revocation lifecycle', () => {
  it('POST /revoke flips status + closes runtime WS (4401) + emits /logs events', async () => {
    const { port, registry } = await spinUp();
    const { ws } = await connectAndRegister(port, 'alpha');

    // Subscribe to /logs before revoking
    const { logEntries, statusChanges } = await subscribeToLogs(port);

    // POST /revoke
    const revokeRes = await fetch(`http://127.0.0.1:${port}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha', reason: 'suspected_clone' }),
    });
    expect(revokeRes.status).toBe(200);
    const revokeBody = await revokeRes.json() as { status: string };
    expect(revokeBody.status).toBe('revoked');

    // Runtime WS should receive close with code 4401
    const [closeCode, closeReason] = await once(ws, 'close') as [number, Buffer];
    expect(closeCode).toBe(4401);
    expect(closeReason.toString()).toBe('revoked');

    // Give /logs subscriber a tick
    await new Promise((r) => setTimeout(r, 100));

    // Registry status must be 'revoked'
    const record = registry.get('alpha');
    expect(record?.status).toBe('revoked');

    // /logs must have log_entry (revoke event)
    const revokeEntry = logEntries.find((e) => e.runtimeId === 'alpha' && e.level === 'warn');
    expect(revokeEntry).toBeDefined();

    // /logs must have status_change → revoked
    const revokedChange = statusChanges.find((e) => e.runtimeId === 'alpha' && e.status === 'revoked');
    expect(revokedChange).toBeDefined();
  });

  it('re-register after revoke is rejected: WS close 4403 + register_rejected_revoked log', async () => {
    const { port } = await spinUp();
    const { pubkeyB64 } = await connectAndRegister(port, 'alpha');

    // Subscribe to /logs
    const { logEntries } = await subscribeToLogs(port);

    // Revoke alpha
    await fetch(`http://127.0.0.1:${port}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha', reason: 'test_revoke' }),
    });

    // Wait briefly for revoke to process (WS close event)
    await new Promise((r) => setTimeout(r, 100));

    // Simulate reconnect: open a fresh WS, send RegisterMsg for the same runtimeId
    // Using mockSocket directly (not RuntimeAgent — its auto-reconnect muddies the test)
    const wsReconnect = await connectRuntime(port);
    openSockets.push(wsReconnect);
    wsReconnect.send(JSON.stringify({ type: 'register', runtimeId: 'alpha', pubkey: pubkeyB64 }));

    // Should be rejected with close 4403 (revoked)
    const [closeCode] = await once(wsReconnect, 'close') as [number];
    expect(closeCode).toBe(4403);

    // Give /logs a tick
    await new Promise((r) => setTimeout(r, 100));

    // Assert register_rejected_revoked log_entry
    const rejectedEntry = logEntries.find(
      (e) => e.runtimeId === 'alpha' && /register_rejected_revoked/.test(e.message),
    );
    expect(rejectedEntry).toBeDefined();

    // POST /distribute against revoked + offline alpha should return 409 runtime_offline
    const distRes = await fetch(`http://127.0.0.1:${port}/distribute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha', payload: 'AQID' }),
    });
    expect(distRes.status).toBe(409);
    const distBody = await distRes.json() as { error: string };
    expect(distBody.error).toBe('runtime_offline');
  });

  it('revoke nonexistent id is idempotent 200', async () => {
    const { port } = await spinUp();

    // Revoke an id that never registered
    const res = await fetch(`http://127.0.0.1:${port}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'ghost-runtime', reason: 'test' }),
    });
    // Per plan default: 200 idempotent (forceRevoke is idempotent)
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('revoked');
  });
});

/**
 * /logs WebSocket broadcast integration tests for Plan 03-03.
 * Three cases: single subscriber, multi-subscriber fan-out, subscriber drop on close.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import { allocPort, tempRegistryPath } from './setup.js';
import { Registry } from '../src/registry/Registry.js';
import { ActiveSessions } from '../src/sessions/ActiveSessions.js';
import { LogBus } from '../src/log/LogBus.js';
import { HandshakeCoordinator } from '../src/handshake/HandshakeCoordinator.js';
import * as nonces from '../src/handshake/nonces.js';
import { createOperatorServer } from '../src/http/server.js';
import { PrivkeyVault } from '../src/rotation/PrivkeyVault.js';

// ─── Per-test cleanup ─────────────────────────────────────────────────────────

let httpServer: Server | undefined;
const openSockets: WebSocket[] = [];

function track(ws: WebSocket) {
  openSockets.push(ws);
  return ws;
}

afterEach(async () => {
  for (const ws of openSockets) {
    if (ws.readyState < 2) ws.close();
  }
  openSockets.length = 0;
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    httpServer = undefined;
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function spinUp() {
  const port = await allocPort();
  const registry = await Registry.load(tempRegistryPath());
  const sessions = new ActiveSessions();
  const logBus = new LogBus();
  const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });
  const { httpServer: srv } = createOperatorServer({ registry, sessions, logBus, coordinator, vault: new PrivkeyVault(), webhookSecret: 'test-secret' });
  await new Promise<void>((resolve) => srv.listen(port, '127.0.0.1', () => resolve()));
  httpServer = srv;
  return { port, logBus, coordinator };
}

function connectLogs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/logs`);
    const onOpen = () => { cleanup(); resolve(ws); };
    const onError = (err: Error) => { cleanup(); reject(err); };
    const onClose = () => { cleanup(); reject(new Error(`/logs WS closed before opening on port ${port}`)); };
    const cleanup = () => { ws.off('open', onOpen); ws.off('error', onError); ws.off('close', onClose); };
    ws.on('open', onOpen);
    ws.on('error', onError);
    ws.on('close', onClose);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/logs broadcast', () => {
  it('subscriber receives status_change', async () => {
    const { port, logBus } = await spinUp();
    const ws = track(await connectLogs(port));

    // Emit after connection is established
    const msgPromise = once(ws, 'message') as Promise<[Buffer]>;
    logBus.statusChange('alpha', 'registered');

    const [raw] = await msgPromise;
    const frame = JSON.parse(raw.toString()) as { type: string; runtimeId: string; status: string; timestamp: number };
    expect(frame.type).toBe('status_change');
    expect(frame.runtimeId).toBe('alpha');
    expect(frame.status).toBe('registered');
    expect(typeof frame.timestamp).toBe('number');
  });

  it('multi-subscriber fan-out', async () => {
    const { port, logBus } = await spinUp();
    const [ws1, ws2, ws3] = await Promise.all([
      connectLogs(port).then(track),
      connectLogs(port).then(track),
      connectLogs(port).then(track),
    ]);

    const p1 = once(ws1, 'message') as Promise<[Buffer]>;
    const p2 = once(ws2, 'message') as Promise<[Buffer]>;
    const p3 = once(ws3, 'message') as Promise<[Buffer]>;

    logBus.logEntry('beta', 'info', 'fan_out_test');

    const [[r1], [r2], [r3]] = await Promise.all([p1, p2, p3]);
    const f1 = JSON.parse(r1.toString()) as { type: string; timestamp: number };
    const f2 = JSON.parse(r2.toString()) as { type: string; timestamp: number };
    const f3 = JSON.parse(r3.toString()) as { type: string; timestamp: number };

    expect(f1.type).toBe('log_entry');
    expect(f2.type).toBe('log_entry');
    expect(f3.type).toBe('log_entry');
    // All three should have the same timestamp (same emitted event object)
    expect(f1.timestamp).toBe(f2.timestamp);
    expect(f2.timestamp).toBe(f3.timestamp);
  });

  it('subscriber drop on close does not throw on operator side', async () => {
    const { port, logBus } = await spinUp();

    // Open two subscribers
    const ws1 = track(await connectLogs(port));
    const ws2 = track(await connectLogs(port));

    // Close ws1 and wait for it to fully close
    await new Promise<void>((resolve) => {
      ws1.on('close', () => resolve());
      ws1.close();
    });

    // ws2 should still receive the event
    const msgPromise = once(ws2, 'message') as Promise<[Buffer]>;
    logBus.logEntry('gamma', 'info', 'after_drop');
    const [raw] = await msgPromise;
    const frame = JSON.parse(raw.toString()) as { type: string; message: string };
    expect(frame.type).toBe('log_entry');
    expect(frame.message).toBe('after_drop');
    // ws1 is closed — operator should not have thrown (test itself passing confirms this)
  });
});

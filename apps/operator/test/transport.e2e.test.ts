/**
 * WebSocket transport end-to-end tests for Plan 03-03 (TRAN-02).
 * Three cases: register round-trip, invalid frame closes 1003, unknown type closes 1003.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { once } from 'node:events';
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
import { Message } from '@sonar/shared';

// ─── Per-test cleanup ─────────────────────────────────────────────────────────

let httpServer: Server | undefined;

afterEach(async () => {
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
  return { port, registry, sessions, logBus, coordinator };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('transport e2e (TRAN-02)', () => {
  it('Register round-trip: sends RegisterMsg, receives RegisteredMsg, registry updated', async () => {
    const { port, registry } = await spinUp();
    const kp = freshKeypair();

    const ws = await connectRuntime(port);
    ws.send(JSON.stringify({ type: 'register', runtimeId: 'beta', pubkey: kp.pubkeyB64 }));

    const [raw] = await once(ws, 'message') as [Buffer];
    const frame = JSON.parse(raw.toString());

    // Use Message.parse for schema validation (Nyquist dim 1)
    const msg = Message.parse(frame);
    expect(msg.type).toBe('registered');
    if (msg.type === 'registered') {
      expect(msg.runtimeId).toBe('beta');
    }

    // Registry should contain 'beta' with status 'registered'
    const record = registry.get('beta');
    expect(record).toBeDefined();
    expect(record?.status).toBe('registered');

    ws.close();
  });

  it('Invalid frame closes 1003', async () => {
    const { port } = await spinUp();
    const ws = await connectRuntime(port);

    ws.send('not json at all');

    const [code] = await once(ws, 'close') as [number, Buffer];
    expect(code).toBe(1003);
  });

  it('Unknown message type closes 1003', async () => {
    const { port } = await spinUp();
    const ws = await connectRuntime(port);

    ws.send(JSON.stringify({ type: 'unknown', runtimeId: 'x' }));

    const [code] = await once(ws, 'close') as [number, Buffer];
    expect(code).toBe(1003);
  });
});

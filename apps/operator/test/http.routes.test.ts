/**
 * HTTP routes integration tests for Plan 03-03.
 * Six cases covering /runtimes, /distribute, /revoke.
 * Uses Node 20+ fetch (no supertest); spins up createOperatorServer on ephemeral port.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { once } from 'node:events';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ed2curve from 'ed2curve';
import type WebSocket from 'ws';
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
import type { AckMsg } from '@sonar/shared';

// ─── Per-test cleanup ─────────────────────────────────────────────────────────

let httpServer: Server | undefined;
const openSockets: WebSocket[] = [];

function closeSocket(ws: WebSocket) {
  openSockets.push(ws);
}

afterEach(async () => {
  // Close all open WS clients
  for (const ws of openSockets) {
    if (ws.readyState < 2) ws.close();
  }
  openSockets.length = 0;
  // Close HTTP server
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    httpServer = undefined;
  }
});

// ─── Helper: spin up operator on ephemeral port ───────────────────────────────

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

describe('HTTP routes', () => {
  it('GET /runtimes — empty', async () => {
    const { port } = await spinUp();
    const res = await fetch(`http://127.0.0.1:${port}/runtimes`);
    expect(res.status).toBe(200);
    const body = await res.json() as { runtimes: unknown[] };
    expect(body).toEqual({ runtimes: [] });
  });

  it('GET /runtimes — populated', async () => {
    const { port, registry } = await spinUp();
    await registry.upsert({ runtimeId: 'r1', pubkey: 'pk1', status: 'registered', registeredAt: 1000 });
    await registry.upsert({ runtimeId: 'r2', pubkey: 'pk2', status: 'awaiting', registeredAt: 2000 });
    const res = await fetch(`http://127.0.0.1:${port}/runtimes`);
    expect(res.status).toBe(200);
    const body = await res.json() as { runtimes: unknown[] };
    expect(body.runtimes).toHaveLength(2);
    // Field allow-list: only runtimeId, status, registeredAt
    const r1 = (body.runtimes as Array<Record<string, unknown>>).find(r => r['runtimeId'] === 'r1');
    expect(r1).toEqual({ runtimeId: 'r1', status: 'registered', registeredAt: 1000 });
    expect(r1).not.toHaveProperty('pubkey');
    expect(r1).not.toHaveProperty('lastHandshakeAt');
  });

  it('POST /distribute — runtime_offline', async () => {
    const { port } = await spinUp();
    const res = await fetch(`http://127.0.0.1:${port}/distribute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha', payload: 'SGVsbG8=' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('runtime_offline');
  });

  it('POST /distribute — invalid_request (missing payload)', async () => {
    const { port } = await spinUp();
    const res = await fetch(`http://127.0.0.1:${port}/distribute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha' }), // missing payload
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_request');
  });

  it('POST /distribute — happy path: full round-trip', async () => {
    const { port, coordinator } = await spinUp();
    const kp = freshKeypair();

    // Step 1: Connect runtime WS and register
    const ws = await connectRuntime(port);
    closeSocket(ws);
    ws.send(JSON.stringify({ type: 'register', runtimeId: 'alpha', pubkey: kp.pubkeyB64 }));
    const [registeredRaw] = await once(ws, 'message') as [Buffer];
    const registered = JSON.parse(registeredRaw.toString()) as { type: string };
    expect(registered.type).toBe('registered');

    // Step 2: Set up message handler to drive challenge-response flow
    let decryptedBytes: Uint8Array | null = null;
    const distributeComplete = new Promise<void>((resolveAll) => {
      ws.on('message', (raw: Buffer) => {
        const frame = JSON.parse(raw.toString()) as {
          type: string;
          nonce?: string;
          runtimeId?: string;
          ciphertext?: string;
          ephemeralPubkey?: string;
        };
        if (frame.type === 'challenge' && frame.nonce && frame.runtimeId) {
          // Sign concat(nonce, runtimeId)
          const nonceBytes = naclUtil.decodeBase64(frame.nonce);
          const idBytes = naclUtil.decodeUTF8(frame.runtimeId);
          const msg = new Uint8Array(nonceBytes.length + idBytes.length);
          msg.set(nonceBytes, 0);
          msg.set(idBytes, nonceBytes.length);
          const signature = kp.sign(msg);
          ws.send(JSON.stringify({ type: 'signed_response', runtimeId: 'alpha', signature }));
        } else if (frame.type === 'encrypted_payload' && frame.ciphertext && frame.ephemeralPubkey && frame.nonce) {
          // Decrypt using runtime's X25519 secret key
          const myXSec = ed2curve.convertSecretKey(kp.keypair.secretKey);
          const decrypted = nacl.box.open(
            naclUtil.decodeBase64(frame.ciphertext),
            naclUtil.decodeBase64(frame.nonce),
            naclUtil.decodeBase64(frame.ephemeralPubkey),
            myXSec!,
          );
          decryptedBytes = decrypted;
          const ack: AckMsg = { type: 'ack', runtimeId: 'alpha', status: 'ready' };
          ws.send(JSON.stringify(ack));
          resolveAll();
        }
      });
    });

    // Step 3: POST /distribute — this drives issueChallenge + distribute internally
    const distributeRes = fetch(`http://127.0.0.1:${port}/distribute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha', payload: 'SGVsbG8=' }), // base64('Hello')
    });

    await distributeComplete;
    const res = await distributeRes;
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ack');

    // Assert the runtime received and decrypted 'Hello'
    expect(decryptedBytes).not.toBeNull();
    expect(Buffer.from(decryptedBytes!).toString('utf8')).toBe('Hello');
  });

  it('POST /revoke — happy path', async () => {
    const { port, registry } = await spinUp();
    const kp = freshKeypair();

    // Connect + register a runtime
    const ws = await connectRuntime(port);
    closeSocket(ws);
    ws.send(JSON.stringify({ type: 'register', runtimeId: 'alpha', pubkey: kp.pubkeyB64 }));
    const [registeredRaw] = await once(ws, 'message') as [Buffer];
    const registered = JSON.parse(registeredRaw.toString()) as { type: string };
    expect(registered.type).toBe('registered');

    // POST /revoke
    const revokeRes = await fetch(`http://127.0.0.1:${port}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha' }),
    });
    expect(revokeRes.status).toBe(200);
    const revokeBody = await revokeRes.json() as { status: string };
    expect(revokeBody.status).toBe('revoked');

    // Wait for WS client to receive close (code 4401, reason 'revoked')
    const [closeCode] = await once(ws, 'close') as [number, Buffer];
    expect(closeCode).toBe(4401);

    // GET /runtimes should show alpha as revoked
    const runtimesRes = await fetch(`http://127.0.0.1:${port}/runtimes`);
    const runtimesBody = await runtimesRes.json() as { runtimes: Array<{ runtimeId: string; status: string }> };
    const alpha = runtimesBody.runtimes.find(r => r.runtimeId === 'alpha');
    expect(alpha?.status).toBe('revoked');

    // Avoid unused warning
    void registry;
  });
});

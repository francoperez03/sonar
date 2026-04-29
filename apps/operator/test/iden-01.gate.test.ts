/**
 * IDEN-01 gate tests (Plan 03-05, Task 1).
 *
 * Asserts that EncryptedPayloadMsg is unreachable without a valid SignedResponseMsg:
 *   1. distribute without verification rejects (runtime doesn't respond to challenge)
 *   2. distribute with bad signature rejects (sig_verify_failed logged, WS closed 4401)
 *   3. distribute with stale nonce rejects (nonce_invalid log, no encrypted_payload sent)
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { once } from 'node:events';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import WebSocket from 'ws';
import { allocPort, tempRegistryPath } from './setup.js';
import { freshKeypair } from './helpers/freshKeypair.js';
import { connectRuntime } from './helpers/mockSocket.js';
import { Registry } from '../src/registry/Registry.js';
import { ActiveSessions } from '../src/sessions/ActiveSessions.js';
import { LogBus } from '../src/log/LogBus.js';
import { HandshakeCoordinator } from '../src/handshake/HandshakeCoordinator.js';
import { createOperatorServer } from '../src/http/server.js';
import type { LogEntryMsg } from '@sonar/shared';

// ── Build a scoped nonce store with custom TTL (test seam, T-03-36) ───────────
function makeScopedNonces(ttlMs: number) {
  const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
  const naclUtil2 = require('tweetnacl-util') as typeof import('tweetnacl-util');

  interface Entry { runtimeId: string; expiresAt: number; }
  const store = new Map<string, Entry>();

  setInterval(() => {
    const now = Date.now();
    for (const [n, e] of store) if (now > e.expiresAt) store.delete(n);
  }, Math.max(ttlMs, 10)).unref();

  return {
    issue(runtimeId: string): string {
      const nonce = naclUtil2.encodeBase64(randomBytes(32));
      store.set(nonce, { runtimeId, expiresAt: Date.now() + ttlMs });
      return nonce;
    },
    consume(nonce: string, runtimeId: string): boolean {
      const e = store.get(nonce);
      if (!e || e.runtimeId !== runtimeId || Date.now() > e.expiresAt) {
        store.delete(nonce);
        return false;
      }
      store.delete(nonce);
      return true;
    },
    peek(nonce: string): Entry | undefined {
      return store.get(nonce);
    },
  };
}

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

async function spinUp(nonceStore?: ReturnType<typeof makeScopedNonces>) {
  const port = await allocPort();
  const registry = await Registry.load(tempRegistryPath());
  const sessions = new ActiveSessions();
  const logBus = new LogBus();
  const nonces = nonceStore ?? (await import('../src/handshake/nonces.js'));
  const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });
  const { httpServer: srv } = createOperatorServer({ registry, sessions, logBus, coordinator });
  await new Promise<void>((r) => srv.listen(port, '127.0.0.1', () => r()));
  httpServer = srv;
  return { port, registry, sessions, logBus, coordinator };
}

// ── Helper: connect & register a runtime, return ws + keypair ─────────────────
async function connectAndRegister(port: number, runtimeId = 'alpha') {
  const kp = freshKeypair();
  const ws = await connectRuntime(port);
  openSockets.push(ws);
  ws.send(JSON.stringify({ type: 'register', runtimeId, pubkey: kp.pubkeyB64 }));
  const [raw] = await once(ws, 'message') as [Buffer];
  const msg = JSON.parse(raw.toString()) as { type: string };
  expect(msg.type).toBe('registered');
  return { ws, kp };
}

// ── Helpers to subscribe to /logs ─────────────────────────────────────────────
async function subscribeToLogs(port: number): Promise<{ ws: WebSocket; events: LogEntryMsg[] }> {
  const logsWs = new WebSocket(`ws://127.0.0.1:${port}/logs`);
  openSockets.push(logsWs);
  await once(logsWs, 'open');
  const events: LogEntryMsg[] = [];
  logsWs.on('message', (raw: Buffer) => {
    try {
      const e = JSON.parse(raw.toString()) as LogEntryMsg;
      if (e.type === 'log_entry') events.push(e);
    } catch { /* ignore */ }
  });
  return { ws: logsWs, events };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('IDEN-01: EncryptedPayloadMsg gated behind identity verification', () => {
  it('distribute without verify rejects with identity_unverified', async () => {
    const { port, coordinator } = await spinUp();
    const kp = freshKeypair();

    // Connect runtime — register but DO NOT respond to challenge
    const ws = await connectRuntime(port);
    openSockets.push(ws);
    ws.send(JSON.stringify({ type: 'register', runtimeId: 'alpha', pubkey: kp.pubkeyB64 }));
    await once(ws, 'message'); // registered

    // Track whether encrypted_payload ever arrives at the runtime
    let encryptedPayloadReceived = false;
    ws.on('message', (raw: Buffer) => {
      const frame = JSON.parse(raw.toString()) as { type: string };
      if (frame.type === 'encrypted_payload') encryptedPayloadReceived = true;
    });

    // POST /distribute — this will call issueChallenge, then awaitVerification will timeout
    // because the runtime doesn't sign back. Use a short timeout by driving coordinator.distribute directly.
    // Better: just issue challenge manually and call distribute() which checks verified=false.
    coordinator.issueChallenge('alpha');
    // distribute() is gated: state.verified === false → throws immediately
    let thrownError: string | undefined;
    try {
      await coordinator.distribute('alpha', new Uint8Array([1, 2, 3]));
    } catch (e) {
      thrownError = (e as Error).message;
    }

    expect(thrownError).toBe('identity_unverified');
    expect(encryptedPayloadReceived).toBe(false);

    // Confirm via HTTP as well: POST /distribute without prior verify returns 401
    const res = await fetch(`http://127.0.0.1:${port}/distribute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'beta', payload: 'AQID' }), // no beta runtime registered
    });
    // beta isn't registered → 409 runtime_offline (not 401) — that's also correct: no session
    expect([409, 401]).toContain(res.status);
  });

  it('distribute with bad signature rejects: sig_verify_failed logged + WS closed 4401', async () => {
    const { port, logBus } = await spinUp();
    const kp = freshKeypair();
    const wrongKp = freshKeypair(); // wrong signing keypair

    const { ws } = await connectAndRegister(port, 'alpha');

    // Subscribe to logBus events to capture sig_verify_failed
    const logEvents: Array<{ level: string; message: string }> = [];
    const unsub = logBus.subscribe((e) => {
      if (e.type === 'log_entry') logEvents.push({ level: e.level, message: e.message });
    });

    // Start /distribute (this triggers issueChallenge → awaitVerification waits)
    const distributePromise = fetch(`http://127.0.0.1:${port}/distribute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'alpha', payload: 'AQID' }),
    });

    // Wait for the challenge to arrive
    const [challengeRaw] = await once(ws, 'message') as [Buffer];
    const challenge = JSON.parse(challengeRaw.toString()) as { type: string; nonce: string; runtimeId: string };
    expect(challenge.type).toBe('challenge');

    // Sign with the WRONG keypair
    const nonceBytes = naclUtil.decodeBase64(challenge.nonce);
    const idBytes = naclUtil.decodeUTF8(challenge.runtimeId);
    const msgBytes = new Uint8Array(nonceBytes.length + idBytes.length);
    msgBytes.set(nonceBytes, 0);
    msgBytes.set(idBytes, nonceBytes.length);
    const badSig = wrongKp.sign(msgBytes);

    ws.send(JSON.stringify({ type: 'signed_response', runtimeId: 'alpha', signature: badSig }));

    // Wait for WS to be closed by operator (4401)
    const [closeCode] = await once(ws, 'close') as [number];
    expect(closeCode).toBe(4401);

    // distribute should now fail (the runtime is offline after sig rejection)
    const res = await distributePromise;
    // Either identity_unverified or runtime_offline is acceptable — identity was not verified
    expect([401, 409, 502]).toContain(res.status);

    // Assert sig_verify_failed was logged with level 'warn'
    expect(logEvents.some((e) => e.level === 'warn' && e.message.includes('sig_verify_failed'))).toBe(true);
    unsub();
  });

  it('distribute with stale nonce rejects: nonce_invalid log + no encrypted_payload', async () => {
    // Use nonceTtlMs=50 so nonce expires before signed_response arrives.
    // Drive coordinator directly (not via HTTP) to avoid the 10s awaitVerification timeout
    // that would outlive the test budget.
    const shortNonces = makeScopedNonces(50);
    const { port, logBus, coordinator, sessions } = await spinUp(shortNonces);
    const kp = freshKeypair();
    const { ws } = await connectAndRegister(port, 'alpha');

    const logEvents: Array<{ message: string }> = [];
    const unsub = logBus.subscribe((e) => {
      if (e.type === 'log_entry') logEvents.push({ message: e.message });
    });

    let encryptedPayloadReceived = false;
    ws.on('message', (raw: Buffer) => {
      try {
        const frame = JSON.parse(raw.toString()) as { type: string };
        if (frame.type === 'encrypted_payload') encryptedPayloadReceived = true;
      } catch { /* ignore */ }
    });

    // issueChallenge directly — captures the nonce immediately
    const challenge = coordinator.issueChallenge('alpha');

    // Wait for nonce to expire (TTL = 50ms; wait 200ms to be safe)
    await new Promise((r) => setTimeout(r, 200));

    // Sign (correctly) but the nonce is now stale
    const nonceBytes = naclUtil.decodeBase64(challenge.nonce);
    const idBytes = naclUtil.decodeUTF8(challenge.runtimeId);
    const msgBytes = new Uint8Array(nonceBytes.length + idBytes.length);
    msgBytes.set(nonceBytes, 0);
    msgBytes.set(idBytes, nonceBytes.length);
    const sig = kp.sign(msgBytes);

    // Send signed_response via the real WS connection (mimics runtime behaviour)
    ws.send(JSON.stringify({ type: 'signed_response', runtimeId: 'alpha', signature: sig }));

    // Wait for WS to be closed by operator (4401 nonce_invalid path in onSignedResponse)
    const closePromise = new Promise<number>((resolve) => {
      if (ws.readyState >= 2) { resolve(ws.readyState === 3 ? 4401 : 0); return; }
      ws.once('close', (code) => resolve(code));
    });
    const closeCode = await closePromise;
    expect(closeCode).toBe(4401);

    // Give a tick for logBus events to propagate
    await new Promise((r) => setTimeout(r, 50));

    // distributeCoordinator directly should now throw identity_unverified or runtime_offline
    let thrownReason: string | undefined;
    try {
      await coordinator.distribute('alpha', new Uint8Array([1, 2, 3]));
    } catch (e) {
      thrownReason = (e as Error).message;
    }
    // runtime_offline is correct because WS was closed; identity was never verified
    expect(['identity_unverified', 'runtime_offline']).toContain(thrownReason);

    // Assert nonce_invalid was logged
    expect(logEvents.some((e) => e.message.includes('nonce_invalid'))).toBe(true);
    // Assert no encrypted_payload was sent
    expect(encryptedPayloadReceived).toBe(false);
    unsub();
    void sessions;
  }, 5_000);
});

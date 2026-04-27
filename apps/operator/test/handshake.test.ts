import { describe, it, expect, vi } from 'vitest';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ed2curve from 'ed2curve';
import type { WebSocket } from 'ws';
import { freshKeypair } from './helpers/freshKeypair.js';
import { Registry } from '../src/registry/Registry.js';
import { ActiveSessions } from '../src/sessions/ActiveSessions.js';
import { LogBus } from '../src/log/LogBus.js';
import * as nonces from '../src/handshake/nonces.js';
import { HandshakeCoordinator } from '../src/handshake/HandshakeCoordinator.js';
import type { AckMsg, SignedResponseMsg } from '@sonar/shared';

// ─── FakeSocket ─────────────────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => void;

class FakeSocket {
  readyState = 1; // OPEN
  sentFrames: string[] = [];
  private handlers: Record<string, EventHandler[]> = {};

  send(data: string | Buffer | Uint8Array): void {
    this.sentFrames.push(data.toString());
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = 3; // CLOSED
    this._emit('close', _code, _reason);
  }

  terminate(): void {
    this.readyState = 3;
    this._emit('close', 1006, 'terminated');
  }

  on(event: string, handler: EventHandler): this {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }

  once(event: string, handler: EventHandler): this {
    const wrapper = (...args: unknown[]) => {
      handler(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event: string, handler: EventHandler): this {
    this.handlers[event] = (this.handlers[event] ?? []).filter(h => h !== handler);
    return this;
  }

  _emit(event: string, ...args: unknown[]): void {
    for (const h of this.handlers[event] ?? []) h(...args);
  }

  lastSent(): unknown {
    const last = this.sentFrames[this.sentFrames.length - 1];
    return last ? JSON.parse(last) : undefined;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSignedResponse(
  challenge: { nonce: string; runtimeId: string },
  kp: ReturnType<typeof freshKeypair>,
): SignedResponseMsg {
  const nonceBytes = naclUtil.decodeBase64(challenge.nonce);
  const idBytes = naclUtil.decodeUTF8(challenge.runtimeId);
  const message = new Uint8Array(nonceBytes.length + idBytes.length);
  message.set(nonceBytes, 0);
  message.set(idBytes, nonceBytes.length);
  const signature = kp.sign(message);
  return { type: 'signed_response', runtimeId: challenge.runtimeId, signature };
}

async function buildRegistryWithRecord(pubkeyB64: string, runtimeId = 'alpha'): Promise<Registry> {
  // Use in-memory only path that won't exist on disk
  const reg = await Registry.load('/tmp/never-' + Math.random().toString(36).slice(2) + '.json');
  // We need to override the flush since we don't care about disk in coordinator tests
  // But Registry.load from missing path gives empty registry, then upsert writes to /tmp
  // That's fine for these unit tests.
  await reg.upsert({ runtimeId, pubkey: pubkeyB64, status: 'registered', registeredAt: Date.now() });
  return reg;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('handshake coordinator', () => {
  it('happy path: full handshake distributes and decrypts correctly', async () => {
    const kp = freshKeypair();
    const registry = await buildRegistryWithRecord(kp.pubkeyB64, 'alpha');
    const sessions = new ActiveSessions();
    const logBus = new LogBus();
    const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });

    const fakeWs = new FakeSocket();
    coordinator.bindSession('alpha', fakeWs as unknown as WebSocket);

    // Issue challenge
    const challenge = coordinator.issueChallenge('alpha');
    expect(challenge.type).toBe('challenge');
    expect(challenge.runtimeId).toBe('alpha');

    // Sign the challenge
    const signedResponse = buildSignedResponse(challenge, kp);
    coordinator.onSignedResponse(fakeWs as unknown as WebSocket, signedResponse);

    // Distribute payload
    const distributePromise = coordinator.distribute('alpha', new Uint8Array([1, 2, 3, 4]));

    // Get the encrypted payload message that was sent
    const encMsg = fakeWs.lastSent() as { type: string; ciphertext: string; ephemeralPubkey: string; nonce: string; runtimeId: string };
    expect(encMsg.type).toBe('encrypted_payload');
    expect(encMsg.runtimeId).toBe('alpha');

    // Simulate runtime decrypting
    const myXSec = ed2curve.convertSecretKey(kp.keypair.secretKey);
    expect(myXSec).not.toBeNull();
    const decrypted = nacl.box.open(
      naclUtil.decodeBase64(encMsg.ciphertext),
      naclUtil.decodeBase64(encMsg.nonce),
      naclUtil.decodeBase64(encMsg.ephemeralPubkey),
      myXSec!,
    );
    expect(decrypted).not.toBeNull();
    expect(Array.from(decrypted!)).toEqual([1, 2, 3, 4]);

    // Send ack
    const ack: AckMsg = { type: 'ack', runtimeId: 'alpha', status: 'ready' };
    coordinator.onAck(fakeWs as unknown as WebSocket, ack);

    const result = await distributePromise;
    expect(result.status).toBe('ready');

    // Check LogBus emitted a status_change to 'received'
    // (verified indirectly by checking registry was updated)
    const record = registry.get('alpha');
    expect(record?.status).toBe('received');
    expect(record?.lastHandshakeAt).toBeGreaterThan(0);
  });

  it('IDEN-01 gate: distribute rejects without prior verified signed_response', async () => {
    const kp = freshKeypair();
    const registry = await buildRegistryWithRecord(kp.pubkeyB64, 'alpha');
    const sessions = new ActiveSessions();
    const logBus = new LogBus();
    const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });

    const fakeWs = new FakeSocket();
    coordinator.bindSession('alpha', fakeWs as unknown as WebSocket);
    coordinator.issueChallenge('alpha');

    // Do NOT call onSignedResponse — identity is unverified
    await expect(coordinator.distribute('alpha', new Uint8Array([1, 2, 3]))).rejects.toThrow(
      'identity_unverified',
    );

    // No EncryptedPayloadMsg should have been sent
    const encFrames = fakeWs.sentFrames.filter(f => {
      try {
        return JSON.parse(f).type === 'encrypted_payload';
      } catch {
        return false;
      }
    });
    expect(encFrames).toHaveLength(0);
  });

  it('invalid signature: onSignedResponse marks session failed', async () => {
    const kp = freshKeypair();
    const wrongKp = freshKeypair(); // different keypair
    const registry = await buildRegistryWithRecord(kp.pubkeyB64, 'alpha');
    const sessions = new ActiveSessions();
    const logBus = new LogBus();
    const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });

    const logEntries: Array<{ level: string; message: string }> = [];
    logBus.subscribe(e => {
      if (e.type === 'log_entry') logEntries.push({ level: e.level, message: e.message });
    });

    const fakeWs = new FakeSocket();
    coordinator.bindSession('alpha', fakeWs as unknown as WebSocket);
    const challenge = coordinator.issueChallenge('alpha');

    // Sign with WRONG keypair
    const badSignedResponse = buildSignedResponse(challenge, wrongKp);
    // Fix the runtimeId to be alpha so it routes correctly
    const spoofed: SignedResponseMsg = { ...badSignedResponse, runtimeId: 'alpha' };
    coordinator.onSignedResponse(fakeWs as unknown as WebSocket, spoofed);

    // Distribute should now fail (identity not verified)
    await expect(coordinator.distribute('alpha', new Uint8Array([1]))).rejects.toThrow(
      'identity_unverified',
    );

    // A warn log_entry should have been emitted
    expect(logEntries.some(e => e.level === 'warn')).toBe(true);
  });

  it('nonce reuse: consume returns true once then false', () => {
    const nonce = nonces.issue('alpha');
    expect(nonces.consume(nonce, 'alpha')).toBe(true);
    expect(nonces.consume(nonce, 'alpha')).toBe(false);
  });
});

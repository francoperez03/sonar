import type { WebSocket } from 'ws';
import type { RegisterMsg, AckMsg, SignedResponseMsg, ChallengeMsg } from '@sonar/shared';
import type { Registry } from '../registry/Registry.js';
import type { ActiveSessions } from '../sessions/ActiveSessions.js';
import type { LogBus } from '../log/LogBus.js';
import * as defaultNonces from './nonces.js';
import { encryptForRuntime } from '../crypto/box.js';
import { verifyChallenge } from '../crypto/verify.js';

type NonceStore = typeof defaultNonces;

interface PendingState {
  nonce: string;
  verified: boolean;
  awaitingAck?: {
    resolve: (result: { status: 'ready' } | { status: 'failed'; reason: string }) => void;
    reject: (err: Error) => void;
  };
}

interface Deps {
  registry: Registry;
  sessions: ActiveSessions;
  logBus: LogBus;
  nonceStore: NonceStore;
}

/**
 * Per-runtimeId handshake state machine.
 * Enforces IDEN-01: EncryptedPayloadMsg is ONLY sent after a valid verifyChallenge.
 */
export class HandshakeCoordinator {
  private registry: Registry;
  private sessions: ActiveSessions;
  private logBus: LogBus;
  private nonceStore: NonceStore;
  private pending = new Map<string, PendingState>();

  constructor(deps: Deps) {
    this.registry = deps.registry;
    this.sessions = deps.sessions;
    this.logBus = deps.logBus;
    this.nonceStore = deps.nonceStore;
  }

  /**
   * Handle an inbound RegisterMsg. Enforces single-active-session (D-07) and revoked check.
   */
  onRegister(ws: WebSocket, msg: RegisterMsg): void {
    const record = this.registry.get(msg.runtimeId);
    if (record?.status === 'revoked') {
      this.logBus.logEntry(msg.runtimeId, 'warn', 'register_rejected_revoked');
      ws.close(4403, 'revoked');
      return;
    }
    const existing = this.sessions.get(msg.runtimeId);
    if (existing && existing !== ws && existing.readyState === 1 /* OPEN */) {
      this.logBus.logEntry(msg.runtimeId, 'warn', 'duplicate_session_rejected');
      ws.close(4409, 'duplicate_session');
      return;
    }
    this.sessions.bind(msg.runtimeId, ws);
    void this.registry.upsert({
      ...record,
      runtimeId: msg.runtimeId,
      pubkey: msg.pubkey,
      status: 'registered',
      registeredAt: record?.registeredAt ?? Date.now(),
    });
    const registered = { type: 'registered' as const, runtimeId: msg.runtimeId };
    ws.send(JSON.stringify(registered));
    this.logBus.statusChange(msg.runtimeId, 'registered');
  }

  /**
   * Bind an already-opened WebSocket to a runtimeId (used when session is already tracked).
   */
  bindSession(runtimeId: string, ws: WebSocket): void {
    this.sessions.bind(runtimeId, ws);
  }

  /**
   * Issue a challenge for a runtimeId and send it through the active socket.
   * Stores pending state with verified=false.
   */
  issueChallenge(runtimeId: string): ChallengeMsg {
    const nonce = this.nonceStore.issue(runtimeId);
    this.pending.set(runtimeId, { nonce, verified: false });
    const challenge: ChallengeMsg = { type: 'challenge', nonce, runtimeId };
    const ws = this.sessions.get(runtimeId);
    if (ws) ws.send(JSON.stringify(challenge));
    this.logBus.statusChange(runtimeId, 'awaiting');
    return challenge;
  }

  /**
   * Handle inbound SignedResponseMsg. Verifies signature; sets verified=true on success.
   */
  onSignedResponse(ws: WebSocket, msg: SignedResponseMsg): void {
    const state = this.pending.get(msg.runtimeId);
    if (!state) {
      ws.close(4400, 'no_pending_challenge');
      return;
    }
    const consumed = this.nonceStore.consume(state.nonce, msg.runtimeId);
    if (!consumed) {
      this.logBus.logEntry(msg.runtimeId, 'warn', 'nonce_invalid_or_expired');
      ws.close(4401, 'nonce_invalid');
      return;
    }
    const record = this.registry.get(msg.runtimeId);
    if (!record) {
      ws.close(4404, 'runtime_not_registered');
      return;
    }
    const valid = verifyChallenge(msg, state.nonce, record.pubkey);
    if (valid) {
      state.verified = true;
    } else {
      state.verified = false;
      this.logBus.logEntry(msg.runtimeId, 'warn', 'sig_verify_failed');
      ws.close(4401, 'sig_verify_failed');
    }
  }

  /**
   * Distribute encrypted payload to a runtime.
   * IDEN-01 gate: throws 'identity_unverified' if no valid signed_response preceded this call.
   */
  async distribute(
    runtimeId: string,
    payloadBytes: Uint8Array,
  ): Promise<{ status: 'ready' } | { status: 'failed'; reason: string }> {
    // IDEN-01: explicit gate — check identity_unverified BEFORE runtime_offline.
    // This ensures the error is always about identity when pending state exists but is unverified.
    const state = this.pending.get(runtimeId);
    if (state !== undefined && !state.verified) {
      throw new Error('identity_unverified');
    }
    const ws = this.sessions.get(runtimeId);
    if (!ws || ws.readyState !== 1 /* OPEN */) {
      throw new Error('runtime_offline');
    }
    if (!state?.verified) {
      // No pending state at all (never issued challenge)
      throw new Error('identity_unverified');
    }
    const record = this.registry.get(runtimeId);
    if (!record) throw new Error('registry_record_not_found');

    const { ciphertext, ephemeralPubkey, nonce } = encryptForRuntime(payloadBytes, record.pubkey);
    const encMsg = { type: 'encrypted_payload' as const, runtimeId, ciphertext, ephemeralPubkey, nonce };
    ws.send(JSON.stringify(encMsg));

    return new Promise((resolve, reject) => {
      state.awaitingAck = { resolve, reject };
      const timeout = setTimeout(() => {
        reject(new Error('ack_timeout'));
        delete state.awaitingAck;
      }, 10_000);
      // Clear timeout when settled
      const originalResolve = state.awaitingAck!.resolve;
      const originalReject = state.awaitingAck!.reject;
      state.awaitingAck = {
        resolve: (r) => { clearTimeout(timeout); originalResolve(r); },
        reject: (e) => { clearTimeout(timeout); originalReject(e); },
      };
    });
  }

  /**
   * Handle inbound AckMsg from the runtime.
   */
  onAck(ws: WebSocket, msg: AckMsg): void {
    const state = this.pending.get(msg.runtimeId);
    if (!state?.awaitingAck) return;

    const { resolve, reject } = state.awaitingAck;
    delete state.awaitingAck;

    if (msg.status === 'ready') {
      void this.registry.setStatus(msg.runtimeId, 'received', Date.now());
      this.logBus.statusChange(msg.runtimeId, 'received');
      resolve({ status: 'ready' });
    } else {
      const reason = msg.reason ?? 'ack_failed';
      this.logBus.logEntry(msg.runtimeId, 'warn', `ack_failed: ${reason}`);
      reject(new Error(reason));
    }
  }

  /**
   * Force-revoke a runtime: flip status, close socket, emit log events.
   * Used by Plan 03's /revoke route.
   */
  forceRevoke(runtimeId: string, reason: string): void {
    void this.registry.setStatus(runtimeId, 'revoked');
    this.sessions.forceClose(runtimeId, 4401, 'revoked');
    this.logBus.logEntry(runtimeId, 'warn', `revoked: ${reason}`);
    this.logBus.statusChange(runtimeId, 'revoked');
  }
}

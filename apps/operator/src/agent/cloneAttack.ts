import { WebSocket } from 'ws';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

/**
 * Spawns a fake "clone" runtime against the operator's /runtime WS endpoint.
 * Generates a fresh ed25519 keypair (i.e. NOT the legitimate runtime's
 * privkey) and tries to RegisterMsg under the target runtimeId. The operator's
 * Phase 7 pubkey-mismatch gate (HandshakeCoordinator.onRegister) closes the
 * socket with code 4403 'pubkey_mismatch' and emits the "Clone rejected:"
 * log_entry that the demo-ui flashes on.
 *
 * Truthful end-to-end: the rejection is exercised through the real handshake
 * code path, not synthesized. Returns the close code/reason observed.
 */
export interface CloneAttackResult {
  rejected: boolean;
  closeCode: number;
  closeReason: string;
}

export async function simulateCloneAttack(opts: {
  runtimeWsUrl: string; // e.g. ws://127.0.0.1:8787/runtime
  runtimeId: string;
  timeoutMs?: number;
}): Promise<CloneAttackResult> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const kp = nacl.sign.keyPair();
  const pubkey = naclUtil.encodeBase64(kp.publicKey);

  return new Promise((resolve) => {
    const ws = new WebSocket(opts.runtimeWsUrl);
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // best-effort
      }
      resolve({ rejected: false, closeCode: 0, closeReason: 'timeout' });
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', runtimeId: opts.runtimeId, pubkey }));
    });
    ws.on('close', (code: number, reason: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      // 4403 'pubkey_mismatch' is the Phase 7 clone-rejection gate; anything
      // non-1000 is a rejection from the operator side.
      const reasonStr = reason.toString('utf8');
      resolve({
        rejected: code !== 1000,
        closeCode: code,
        closeReason: reasonStr,
      });
    });
    ws.on('error', () => {
      // 'close' will follow with a code; nothing to do here.
    });
  });
}

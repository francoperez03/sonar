/**
 * distribute.happy e2e test (Plan 03-05, Task 1).
 *
 * Full end-to-end: real Operator + real RuntimeAgent exchange:
 *   register → challenge → signed_response → encrypted_payload → ack
 *
 * Asserts:
 *   - HTTP 200 {status:'ack'}
 *   - Runtime decrypted bytes match original payload exactly (byte-exact)
 *   - Registry status transitions through awaiting → received (via /logs)
 *
 * Covers: OPER-04 + RUNT-02 + TRAN-02
 */
import { describe, it, expect } from 'vitest';
import naclUtil from 'tweetnacl-util';
import { runFleetSmoke } from './helpers/runFleetSmoke.js';
import type { StatusChangeMsg } from '@sonar/shared';

describe('distribute happy path (e2e)', () => {
  it('register → challenge → signed_response → encrypted_payload → ack: byte-exact decrypt', async () => {
    const PAYLOAD = 'SECRET_API_KEY_xyz';
    const payloadBytes = new TextEncoder().encode(PAYLOAD);
    const payloadB64 = naclUtil.encodeBase64(payloadBytes);

    // Boot one real Operator + one real RuntimeAgent
    const harness = await runFleetSmoke({ ids: ['e2e-alpha'] });

    try {
      const { operatorPort, logsTranscript } = harness;
      const runtime = harness.runtimes[0];

      // Capture decrypted bytes from the runtime's agent by watching logBus
      // The RuntimeAgent decrypts and sends ack:ready; we assert via the ack result
      // For byte-exact assertion, we intercept via the runtime transport's onMessage
      let decryptedBytes: Uint8Array | null = null;
      const { decryptPayload } = await import('../../runtime/src/crypto/decrypt.js');

      // Subscribe to transport messages BEFORE /distribute to catch encrypted_payload
      runtime.transport.onMessage((msg) => {
        if (msg.type === 'encrypted_payload') {
          try {
            const bytes = decryptPayload(msg, runtime.signingKeypair.secretKey);
            decryptedBytes = bytes;
          } catch { /* decrypt error — will show in ack */ }
        }
      });

      // POST /distribute — drives full handshake
      const res = await fetch(`http://127.0.0.1:${operatorPort}/distribute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runtimeId: runtime.runtimeId, payload: payloadB64 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('ack');

      // Assert byte-exact match
      expect(decryptedBytes).not.toBeNull();
      expect(Buffer.compare(Buffer.from(decryptedBytes!), Buffer.from(payloadBytes))).toBe(0);

      // Also confirm string equality for readability
      expect(Buffer.from(decryptedBytes!).toString('utf8')).toBe(PAYLOAD);

      // Assert Registry transitions: should have seen awaiting → received in logsTranscript
      // Give a small tick for events to propagate
      await new Promise((r) => setTimeout(r, 50));
      const statusChanges = logsTranscript
        .filter((e): e is StatusChangeMsg => e.type === 'status_change' && e.runtimeId === runtime.runtimeId)
        .map((e) => e.status);

      expect(statusChanges).toContain('awaiting');
      expect(statusChanges).toContain('received');

    } finally {
      await harness.close();
    }
  }, 15_000);
});

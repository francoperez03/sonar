import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ed2curve from 'ed2curve';

/**
 * Encrypt payloadBytes for a runtime that registered with an Ed25519 pubkey.
 * Ed25519 pubkey is converted to X25519 at use time (D-03).
 * Per RESEARCH Pattern 3 (operator side).
 *
 * OPER-05 anchor: ephemeral.secretKey MUST NOT be assigned to this.*, returned, logged, or persisted.
 * Static grep test (oper-05.invariant) enforces this; do not refactor without updating the test.
 */
export function encryptForRuntime(
  payloadBytes: Uint8Array,
  runtimeEdPubkeyB64: string,
): { ciphertext: string; ephemeralPubkey: string; nonce: string } {
  const runtimeEdPub = naclUtil.decodeBase64(runtimeEdPubkeyB64);
  const runtimeXPub = ed2curve.convertPublicKey(runtimeEdPub);
  if (!runtimeXPub) throw new Error('invalid_ed25519_pubkey');

  const ephemeral = nacl.box.keyPair(); // fresh per distribute (D-02)
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
  const ciphertext = nacl.box(payloadBytes, nonce, runtimeXPub, ephemeral.secretKey);

  // Discard ephemeral.secretKey HERE — it goes out of scope at function return.
  // Do not store, log, or return it. (OPER-05 code-review anchor.)
  return {
    ciphertext: naclUtil.encodeBase64(ciphertext),
    ephemeralPubkey: naclUtil.encodeBase64(ephemeral.publicKey),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { SignedResponseMsg } from '@sonar/shared';

/**
 * Verify an Ed25519 signature over concat(nonce, runtimeId).
 * Domain separation is hard-coded (D-06). Uses the *registered* pubkey,
 * never any pubkey in the response message (IDEN-01 binding, Nyquist dim 3).
 * Per RESEARCH Pattern 4 (operator side).
 */
export function verifyChallenge(
  msg: SignedResponseMsg,
  expectedNonceB64: string,
  registeredPubkeyB64: string,
): boolean {
  const nonceBytes = naclUtil.decodeBase64(expectedNonceB64);
  const idBytes = naclUtil.decodeUTF8(msg.runtimeId);
  const message = new Uint8Array(nonceBytes.length + idBytes.length);
  message.set(nonceBytes, 0);
  message.set(idBytes, nonceBytes.length);
  return nacl.sign.detached.verify(
    message,
    naclUtil.decodeBase64(msg.signature),
    naclUtil.decodeBase64(registeredPubkeyB64),
  );
}

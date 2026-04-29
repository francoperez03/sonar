import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ed2curve from 'ed2curve';
import type { EncryptedPayloadMsg } from '@sonar/shared';

export function decryptPayload(msg: EncryptedPayloadMsg, signingSecretKey: Uint8Array): Uint8Array {
  // Pitfall 7: ed2curve.convertSecretKey accepts the 64-byte secretKey from nacl.sign.keyPair()
  const myXSec = ed2curve.convertSecretKey(signingSecretKey);
  const opened = nacl.box.open(
    naclUtil.decodeBase64(msg.ciphertext),
    naclUtil.decodeBase64(msg.nonce),
    naclUtil.decodeBase64(msg.ephemeralPubkey),
    myXSec,
  );
  // Pattern S-8 / Pitfall 1: guard for null return on bad ciphertext
  if (!opened) throw new Error('decrypt_failed');
  return opened;
}

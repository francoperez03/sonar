import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export interface FreshKeypair {
  keypair: nacl.SignKeyPair;
  pubkeyB64: string;
  sign: (message: Uint8Array) => string; // base64 detached signature
}

/**
 * Generates a fresh Ed25519 keypair for use in tests.
 * Callers compose the message themselves per CONTEXT D-06 (concat(nonce, runtimeId)).
 */
export function freshKeypair(): FreshKeypair {
  const keypair = nacl.sign.keyPair();
  const pubkeyB64 = naclUtil.encodeBase64(keypair.publicKey);
  const sign = (msg: Uint8Array) =>
    naclUtil.encodeBase64(nacl.sign.detached(msg, keypair.secretKey));
  return { keypair, pubkeyB64, sign };
}

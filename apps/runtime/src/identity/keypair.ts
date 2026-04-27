import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export interface RuntimeKeypair {
  keypair: nacl.SignKeyPair;
  pubkeyB64: string;
}

export function generateKeypair(): RuntimeKeypair {
  const keypair = nacl.sign.keyPair();
  return { keypair, pubkeyB64: naclUtil.encodeBase64(keypair.publicKey) };
}

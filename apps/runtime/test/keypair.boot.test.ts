import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ed2curve from 'ed2curve';

// RED: these tests reference modules that don't exist yet
import { generateKeypair } from '../src/identity/keypair.js';
import { decryptPayload } from '../src/crypto/decrypt.js';
import type { EncryptedPayloadMsg } from '@sonar/shared';

function localEncrypt(payload: Uint8Array, edPubB64: string): EncryptedPayloadMsg {
  const xpub = ed2curve.convertPublicKey(naclUtil.decodeBase64(edPubB64));
  if (!xpub) throw new Error('bad pubkey');
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ct = nacl.box(payload, nonce, xpub, eph.secretKey);
  return {
    type: 'encrypted_payload' as const,
    runtimeId: 'test',
    ciphertext: naclUtil.encodeBase64(ct),
    ephemeralPubkey: naclUtil.encodeBase64(eph.publicKey),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

describe('keypair.boot', () => {
  it('case 1: generateKeypair returns valid Ed25519 pubkey (32 bytes) and 64-byte secretKey', () => {
    const { keypair, pubkeyB64 } = generateKeypair();
    const pubBytes = naclUtil.decodeBase64(pubkeyB64);
    expect(pubBytes.length).toBe(32);
    expect(keypair.secretKey.length).toBe(64);
  });

  it('case 2: freshness — two calls produce different pubkeys', () => {
    const a = generateKeypair();
    const b = generateKeypair();
    expect(a.pubkeyB64).not.toBe(b.pubkeyB64);
  });

  it('case 3: module exports only generateKeypair (no top-level secretKey leak)', async () => {
    const mod = await import('../src/identity/keypair.js');
    const keys = Object.keys(mod);
    expect(keys).toContain('generateKeypair');
    // Should not export anything that looks like raw key material
    const cryptoKeys = keys.filter(
      (k) => k !== 'generateKeypair' && (k.toLowerCase().includes('secret') || k.toLowerCase().includes('keypair') || k.toLowerCase().includes('key'))
    );
    expect(cryptoKeys).toHaveLength(0);
  });

  it('case 4: decrypt round-trip — localEncrypt then decryptPayload recovers original bytes', () => {
    const { keypair, pubkeyB64 } = generateKeypair();
    const payload = Uint8Array.from([1, 2, 3, 4, 5]);
    const msg = localEncrypt(payload, pubkeyB64);
    const recovered = decryptPayload(msg, keypair.secretKey);
    expect(Array.from(recovered)).toEqual(Array.from(payload));
  });

  it('case 5: tampered ciphertext throws decrypt_failed', () => {
    const { keypair, pubkeyB64 } = generateKeypair();
    const payload = Uint8Array.from([1, 2, 3, 4, 5]);
    const msg = localEncrypt(payload, pubkeyB64);
    // Tamper the ciphertext
    const ctBytes = naclUtil.decodeBase64(msg.ciphertext);
    ctBytes[0] = ctBytes[0] ^ 0xff;
    const tamperedMsg = { ...msg, ciphertext: naclUtil.encodeBase64(ctBytes) };
    expect(() => decryptPayload(tamperedMsg, keypair.secretKey)).toThrow('decrypt_failed');
  });
});

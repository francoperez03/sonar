declare module 'ed2curve' {
  /**
   * Convert an Ed25519 public key (32 bytes) to a Curve25519 public key (32 bytes).
   * Returns null if the input is not a valid Ed25519 public key.
   */
  export function convertPublicKey(pk: Uint8Array): Uint8Array | null;

  /**
   * Convert an Ed25519 secret key (64 or 32 bytes) to a Curve25519 secret key (32 bytes).
   */
  export function convertSecretKey(sk: Uint8Array): Uint8Array;

  const ed2curve: {
    convertPublicKey: typeof convertPublicKey;
    convertSecretKey: typeof convertSecretKey;
  };
  export default ed2curve;
}

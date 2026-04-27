// Plain string aliases — base64-encoded values.
// No crypto libs imported here (D-12). Operator/Runtime own tweetnacl etc.
export type Ed25519PublicKey = string; // base64
export type Signature = string; // base64

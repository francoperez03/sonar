import { randomBytes } from 'node:crypto';
import naclUtil from 'tweetnacl-util';

interface Entry {
  runtimeId: string;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const TTL_MS = 10_000;

/**
 * Issue a new single-use nonce for a runtimeId. 10s TTL (D-05).
 */
export function issue(runtimeId: string): string {
  const nonce = naclUtil.encodeBase64(randomBytes(32));
  store.set(nonce, { runtimeId, expiresAt: Date.now() + TTL_MS });
  return nonce;
}

/**
 * Consume a nonce for a given runtimeId. Returns true once; false on reuse, wrong id, or expiry.
 * Single-use: deleted on success AND on failed/expired lookup. (D-05)
 */
export function consume(nonce: string, runtimeId: string): boolean {
  const e = store.get(nonce);
  if (!e || e.runtimeId !== runtimeId || Date.now() > e.expiresAt) {
    store.delete(nonce);
    return false;
  }
  store.delete(nonce); // single-use
  return true;
}

/**
 * Peek at a nonce entry without consuming it. For tests only.
 */
export function peek(nonce: string): Entry | undefined {
  return store.get(nonce);
}

// Lazy-expiry sweep every 5s. .unref() so this doesn't keep the process alive. (Pitfall 6)
setInterval(() => {
  const now = Date.now();
  for (const [n, e] of store) if (now > e.expiresAt) store.delete(n);
}, 5_000).unref();

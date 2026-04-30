/**
 * Memory-only ephemeral-wallet store. Per Phase 5 CONTEXT D-07/D-19/D-21.
 *
 * OPER-05 invariant: privkeys never leave this Map. Belt-and-suspenders:
 *   - toJSON() throws so accidental JSON.stringify(vault) fails loudly
 *   - TTL eviction (default 10min) clears entries even if /rotation/complete is never called
 *   - delete() is the explicit happy-path eviction (called from /rotation/complete)
 */
export interface EphemeralWallet {
  address: `0x${string}`;
  privkey: `0x${string}`;
  createdAt: number;
}

export class PrivkeyVault {
  private map = new Map<string, EphemeralWallet[]>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly ttlMs: number = 10 * 60 * 1000) {}

  put(runId: string, wallets: EphemeralWallet[]): void {
    // Refresh: clear any existing timer for this runId before installing a new one.
    const prev = this.timers.get(runId);
    if (prev) clearTimeout(prev);
    this.map.set(runId, wallets);
    const t = setTimeout(() => this.delete(runId), this.ttlMs);
    if (typeof t.unref === 'function') t.unref();
    this.timers.set(runId, t);
  }

  get(runId: string): EphemeralWallet[] | undefined {
    return this.map.get(runId);
  }

  has(runId: string): boolean {
    return this.map.has(runId);
  }

  delete(runId: string): void {
    this.map.delete(runId);
    const t = this.timers.get(runId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(runId);
    }
  }

  /** OPER-05 belt-and-suspenders — accidental JSON.stringify(vault) MUST fail loudly. */
  toJSON(): never {
    throw new Error('PrivkeyVault is not serializable');
  }
}

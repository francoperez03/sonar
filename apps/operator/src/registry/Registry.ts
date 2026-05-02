import type { Ed25519PublicKey } from '@sonar/shared';
import type { StatusChangeMsg } from '@sonar/shared';
import { persist, loadJson } from './persist.js';

export interface RegistryRecord {
  runtimeId: string;
  pubkey: Ed25519PublicKey;           // base64 string
  status: StatusChangeMsg['status'];  // reuse the locked enum
  registeredAt: number;
  lastHandshakeAt?: number;
  // Phase 7: most recent EVM EOA handed to this runtime by /rotation/distribute.
  walletAddress?: `0x${string}`;
  walletAssignedAt?: number;
}

interface StoredShape {
  runtimes: RegistryRecord[];
}

export class Registry {
  private map = new Map<string, RegistryRecord>();

  private constructor(private readonly path: string) {}

  /**
   * Load registry from disk. If file is missing, returns an empty Registry.
   * No file is created until the first mutation.
   */
  static async load(path: string): Promise<Registry> {
    const reg = new Registry(path);
    const raw = await loadJson(path);
    if (raw !== null) {
      const stored = raw as StoredShape;
      for (const record of stored.runtimes ?? []) {
        reg.map.set(record.runtimeId, record);
      }
    }
    return reg;
  }

  list(): RegistryRecord[] {
    return Array.from(this.map.values());
  }

  get(runtimeId: string): RegistryRecord | undefined {
    return this.map.get(runtimeId);
  }

  async upsert(record: RegistryRecord): Promise<void> {
    this.map.set(record.runtimeId, record);
    await this._flush();
  }

  /**
   * Partial-update status (and optionally lastHandshakeAt). Throws if runtimeId not found.
   */
  async setStatus(
    runtimeId: string,
    status: RegistryRecord['status'],
    lastHandshakeAt?: number,
  ): Promise<void> {
    const existing = this.map.get(runtimeId);
    if (!existing) throw new Error(`registry_record_not_found: ${runtimeId}`);
    const updated: RegistryRecord = {
      ...existing,
      status,
      ...(lastHandshakeAt !== undefined ? { lastHandshakeAt } : {}),
    };
    this.map.set(runtimeId, updated);
    await this._flush();
  }

  /**
   * Phase 7: stamp the runtime with the EVM EOA it just received via the
   * rotation distribute path. No-op if the runtimeId is unknown (avoids
   * crashing the distribute fanout when a record is missing).
   */
  async setWallet(
    runtimeId: string,
    walletAddress: `0x${string}`,
    walletAssignedAt: number,
  ): Promise<void> {
    const existing = this.map.get(runtimeId);
    if (!existing) return;
    this.map.set(runtimeId, { ...existing, walletAddress, walletAssignedAt });
    await this._flush();
  }

  async snapshot(): Promise<unknown> {
    return { runtimes: [...this.list()] };
  }

  private async _flush(): Promise<void> {
    await persist(this.path, { runtimes: this.list() });
  }
}

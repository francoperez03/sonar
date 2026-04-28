import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { tempRegistryPath } from './setup.js';
import { freshKeypair } from './helpers/freshKeypair.js';
import { Registry } from '../src/registry/Registry.js';

const cleanupPaths: string[] = [];

afterEach(async () => {
  for (const p of cleanupPaths.splice(0)) {
    await fs.unlink(p).catch(() => {});
  }
});

describe('registry.persist', () => {
  it('round-trip: upsert persists and reloads', async () => {
    const path = tempRegistryPath();
    cleanupPaths.push(path);

    const { pubkeyB64 } = freshKeypair();
    const reg1 = await Registry.load(path);
    await reg1.upsert({ runtimeId: 'alpha', pubkey: pubkeyB64, status: 'registered', registeredAt: 1000 });

    const reg2 = await Registry.load(path);
    const list = reg2.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ runtimeId: 'alpha', pubkey: pubkeyB64, status: 'registered', registeredAt: 1000 });
  });

  it('missing file = empty registry', async () => {
    const path = '/tmp/nonexistent-' + Math.random().toString(36).slice(2) + '.json';
    const reg = await Registry.load(path);
    expect(reg.list()).toHaveLength(0);
  });

  it('setStatus persists: status updated on reload', async () => {
    const path = tempRegistryPath();
    cleanupPaths.push(path);

    const { pubkeyB64 } = freshKeypair();
    const reg1 = await Registry.load(path);
    await reg1.upsert({ runtimeId: 'alpha', pubkey: pubkeyB64, status: 'registered', registeredAt: 1000 });
    await reg1.setStatus('alpha', 'revoked');

    const reg2 = await Registry.load(path);
    const record = reg2.get('alpha');
    expect(record?.status).toBe('revoked');
    expect(record?.lastHandshakeAt).toBeUndefined();
  });

  it('atomic write leaves no partial files on success', async () => {
    const path = tempRegistryPath();
    cleanupPaths.push(path);

    const { pubkeyB64 } = freshKeypair();
    const reg = await Registry.load(path);
    await reg.upsert({ runtimeId: 'alpha', pubkey: pubkeyB64, status: 'registered', registeredAt: 1000 });

    // Only check for tmp files matching THIS specific registry path's base name.
    // Scanning the entire temp dir picks up concurrent test runs' temp files (flaky).
    const dir = path.substring(0, path.lastIndexOf('/'));
    const baseName = path.substring(path.lastIndexOf('/') + 1);
    const files = await fs.readdir(dir);
    const tmpFiles = files.filter(f => f.startsWith(baseName) && f.includes('.tmp.'));
    expect(tmpFiles).toHaveLength(0);
  });
});

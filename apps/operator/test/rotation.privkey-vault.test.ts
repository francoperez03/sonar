/**
 * Unit tests for Phase 5 Plan 03 Task 1:
 *   - PrivkeyVault (Map+TTL+toJSON guard)
 *   - bearerAuth middleware (constant-time compare)
 *   - generateEphemeralWallet (viem-backed)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { PrivkeyVault, type EphemeralWallet } from '../src/rotation/PrivkeyVault.js';
import { generateEphemeralWallet } from '../src/rotation/wallets.js';
import { bearerAuth } from '../src/http/middleware/bearerAuth.js';

function makeWallet(overrides: Partial<EphemeralWallet> = {}): EphemeralWallet {
  return {
    address: '0x0000000000000000000000000000000000000001',
    privkey: '0x' + '11'.repeat(32) as `0x${string}`,
    createdAt: 1_000,
    ...overrides,
  };
}

describe('PrivkeyVault', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('put then get returns the same wallets reference', () => {
    const v = new PrivkeyVault();
    const wallets = [makeWallet()];
    v.put('r1', wallets);
    expect(v.get('r1')).toBe(wallets);
    expect(v.has('r1')).toBe(true);
  });

  it('delete clears the entry', () => {
    const v = new PrivkeyVault();
    v.put('r1', [makeWallet()]);
    v.delete('r1');
    expect(v.get('r1')).toBeUndefined();
    expect(v.has('r1')).toBe(false);
  });

  it('TTL eviction fires after ttlMs', () => {
    vi.useFakeTimers();
    const v = new PrivkeyVault(10 * 60 * 1000);
    v.put('r1', [makeWallet()]);
    expect(v.get('r1')).toBeDefined();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(v.get('r1')).toBeUndefined();
  });

  it('explicit delete clears the timer (no eviction throw on already-deleted key)', () => {
    vi.useFakeTimers();
    const v = new PrivkeyVault(1_000);
    v.put('r1', [makeWallet()]);
    v.delete('r1');
    // No timer should remain; advancing time must not throw.
    expect(() => vi.advanceTimersByTime(5_000)).not.toThrow();
    expect(v.get('r1')).toBeUndefined();
  });

  it('JSON.stringify(vault) throws — OPER-05 belt-and-suspenders', () => {
    const v = new PrivkeyVault();
    v.put('r1', [makeWallet()]);
    expect(() => JSON.stringify(v)).toThrow(/PrivkeyVault is not serializable/);
  });
});

describe('bearerAuth middleware', () => {
  function makeMocks(headers: Record<string, string | undefined> = {}) {
    const req = { headers } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    return { req, res, next, status, json };
  }

  it('calls next() when authorization matches', () => {
    const mw = bearerAuth('s3cr3t');
    const { req, res, next, status } = makeMocks({ authorization: 'Bearer s3cr3t' });
    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('401 on missing header', () => {
    const mw = bearerAuth('s3cr3t');
    const { req, res, next, status, json } = makeMocks({});
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'unauthorized' });
  });

  it('401 on wrong scheme', () => {
    const mw = bearerAuth('s3cr3t');
    const { req, res, next, status } = makeMocks({ authorization: 'Basic s3cr3t' });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('401 on wrong value (same length)', () => {
    const mw = bearerAuth('s3cr3t');
    const { req, res, next, status } = makeMocks({ authorization: 'Bearer XXXXXX' });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('401 on empty value', () => {
    const mw = bearerAuth('s3cr3t');
    const { req, res, next, status } = makeMocks({ authorization: '' });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});

describe('generateEphemeralWallet', () => {
  it('returns address (40 hex) and privkey (64 hex), distinct between calls', () => {
    const w1 = generateEphemeralWallet();
    const w2 = generateEphemeralWallet();
    expect(w1.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(w2.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(w1.privkey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(w2.privkey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(w1.privkey).not.toBe(w2.privkey);
    expect(typeof w1.createdAt).toBe('number');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { runRegistry } from '../src/runRegistry.js';

describe('runRegistry', () => {
  beforeEach(() => {
    // Drain any leftover state from prior tests.
    for (const id of runRegistry.active()) runRegistry.remove(id);
  });

  it('starts empty', () => {
    expect(runRegistry.active()).toEqual([]);
    expect(runRegistry.has('anything')).toBe(false);
  });

  it('round-trips add → has → remove', () => {
    runRegistry.add('run-1');
    expect(runRegistry.has('run-1')).toBe(true);
    expect(runRegistry.active()).toContain('run-1');

    runRegistry.remove('run-1');
    expect(runRegistry.has('run-1')).toBe(false);
    expect(runRegistry.active()).not.toContain('run-1');
  });

  it('active() returns a snapshot — mutating it does not affect the registry', () => {
    runRegistry.add('run-A');
    runRegistry.add('run-B');
    const snap = runRegistry.active();
    snap.push('run-C');
    expect(runRegistry.has('run-C')).toBe(false);
    expect(runRegistry.active().length).toBe(2);
  });
});

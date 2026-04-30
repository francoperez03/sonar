import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/buffer/RingBuffer.js';
import type { LogEntryMsg } from '@sonar/shared';

function entry(runtimeId: string, message: string, timestamp: number): LogEntryMsg {
  return { type: 'log_entry', runtimeId, level: 'info', message, timestamp };
}

describe('RingBuffer (MCP-01)', () => {
  it('push adds events in chronological order until capacity', () => {
    const buf = new RingBuffer(3);
    buf.push(entry('alpha', 'a', 1));
    buf.push(entry('alpha', 'b', 2));
    buf.push(entry('alpha', 'c', 3));

    const snap = buf.snapshot(undefined, 10);
    expect(snap.map((e) => (e as LogEntryMsg).message)).toEqual(['a', 'b', 'c']);
  });

  it('overflow evicts oldest events (capacity stays fixed)', () => {
    const buf = new RingBuffer(3);
    buf.push(entry('alpha', 'a', 1));
    buf.push(entry('alpha', 'b', 2));
    buf.push(entry('alpha', 'c', 3));
    buf.push(entry('alpha', 'd', 4));
    buf.push(entry('alpha', 'e', 5));

    const snap = buf.snapshot(undefined, 10);
    expect(snap.map((e) => (e as LogEntryMsg).message)).toEqual(['c', 'd', 'e']);
    expect(snap.length).toBe(3);
  });

  it('snapshot returns chronological order, filtered by runtimeId, then limited', () => {
    const buf = new RingBuffer(10);
    buf.push(entry('alpha', 'a1', 1));
    buf.push(entry('beta', 'b1', 2));
    buf.push(entry('alpha', 'a2', 3));
    buf.push(entry('beta', 'b2', 4));
    buf.push(entry('alpha', 'a3', 5));

    const onlyAlpha = buf.snapshot({ runtimeId: 'alpha' }, 10);
    expect(onlyAlpha.map((e) => (e as LogEntryMsg).message)).toEqual(['a1', 'a2', 'a3']);

    // Filter applies BEFORE limit (CONTEXT D-14): limit=2 returns last 2 alpha entries.
    const lastTwoAlpha = buf.snapshot({ runtimeId: 'alpha' }, 2);
    expect(lastTwoAlpha.map((e) => (e as LogEntryMsg).message)).toEqual(['a2', 'a3']);
  });

  it('snapshot without filter returns last min(n, size) events', () => {
    const buf = new RingBuffer(10);
    for (let i = 1; i <= 5; i++) buf.push(entry('alpha', `m${i}`, i));
    const last2 = buf.snapshot(undefined, 2);
    expect(last2.map((e) => (e as LogEntryMsg).message)).toEqual(['m4', 'm5']);

    const moreThanSize = buf.snapshot(undefined, 100);
    expect(moreThanSize.length).toBe(5);
  });

  it('snapshot clamps limit to [1, capacity]', () => {
    const buf = new RingBuffer(3);
    buf.push(entry('alpha', 'a', 1));
    buf.push(entry('alpha', 'b', 2));
    buf.push(entry('alpha', 'c', 3));

    // Limit > capacity → clamped to capacity
    const huge = buf.snapshot(undefined, 1_000_000);
    expect(huge.length).toBe(3);

    // Limit < 1 → clamped to 1
    const zero = buf.snapshot(undefined, 0);
    expect(zero.length).toBe(1);
    expect((zero[0] as LogEntryMsg).message).toBe('c');

    const negative = buf.snapshot(undefined, -5);
    expect(negative.length).toBe(1);
  });

  it('throws on capacity < 1', () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
  });
});

import { describe, it } from 'vitest';

describe('RingBuffer (MCP-01)', () => {
  it.todo('push adds events in chronological order until capacity');
  it.todo('overflow evicts oldest events (capacity stays fixed)');
  it.todo('snapshot returns chronological order, filtered, limited');
  it.todo('throws on capacity < 1');
});

import { describe, it } from 'vitest';

describe('connectLogs reconnect (MCP-01)', () => {
  it.todo('reconnects on close with exponential backoff (1s → 2s → ... → 30s cap)');
  it.todo('resets backoff to 1s on a successful open');
  it.todo('parses LogEntryMsg and StatusChangeMsg frames into the buffer');
  it.todo('ignores malformed frames without closing the socket');
  it.todo('stop() halts the reconnect loop');
});

import { describe, it } from 'vitest';

describe('HTTP → MCP error mapping (MCP-02)', () => {
  it.todo('fetch ECONNREFUSED → operator_unavailable');
  it.todo('5xx response → operator_unavailable');
  it.todo('absent runtimeId in /runtimes → runtime_not_found');
  it.todo('status === revoked in /runtimes → already_revoked');
});

import { describe, it } from 'vitest';

describe('revoke tool (MCP-01)', () => {
  it.todo('registers revoke with destructive description and { runtimeId, reason? } inputSchema');
  it.todo('pre-checks GET /runtimes; returns runtime_not_found for unknown id');
  it.todo('returns already_revoked when target status is "revoked"');
  it.todo('forwards reason to operator POST /revoke body when present');
  it.todo('returns operator_unavailable when GET /runtimes throws');
});

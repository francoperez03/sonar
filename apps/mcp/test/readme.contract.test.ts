import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const README = fs.readFileSync(path.resolve(__dirname, '../README.md'), 'utf8');

describe('apps/mcp/README.md contract (MCP-03)', () => {
  it('exists and is at least 40 lines', () => {
    expect(README.split('\n').length).toBeGreaterThanOrEqual(40);
  });
  it('uses absolute-path placeholder for the entry point (Pitfall 4)', () => {
    expect(README).toContain('<ABSOLUTE-PATH-TO-SONAR>');
    expect(README).toContain('/apps/mcp/dist/index.js');
  });
  it('walks through pnpm install + build step', () => {
    expect(README).toMatch(/pnpm install/);
    expect(README).toContain('pnpm --filter @sonar/mcp build');
  });
  it('starts the operator alongside (Phase 3 dev script)', () => {
    expect(README).toContain('pnpm --filter @sonar/operator dev');
  });
  it('tells the user to relaunch/restart Claude Desktop', () => {
    expect(README).toMatch(/(relaunch|restart) Claude Desktop/i);
  });
  it('lists the three example prompts verbatim', () => {
    expect(README).toContain('List my runtimes');
    expect(README).toContain('Revoke alpha because a clone showed up');
    expect(README).toContain('Show the last 50 log events for beta');
  });
  it('claude_desktop_config.json snippet wires node + env vars (D-16, D-17)', () => {
    expect(README).toContain('"command": "node"');
    expect(README).toContain('OPERATOR_HTTP_URL');
    expect(README).toContain('OPERATOR_LOGS_WS');
  });
});

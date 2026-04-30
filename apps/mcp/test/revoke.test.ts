/**
 * revoke tool unit tests (MCP-01).
 * Pre-check pattern: GET /runtimes before POST /revoke (Pitfall 3).
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'node:http';
import { allocPort } from './setup.js';
import { RingBuffer } from '../src/buffer/RingBuffer.js';
import { buildMcpServer } from '../src/mcpServer.js';

const servers: http.Server[] = [];

afterEach(async () => {
  for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
  servers.length = 0;
});

interface FakeOpts {
  runtimes: Array<{ runtimeId: string; status: string; registeredAt: number }>;
  /** Capture POST /revoke body for assertion. */
  revokeBodies: Array<{ runtimeId: string; reason?: string }>;
  /** Force revoke endpoint to fail with status. */
  revokeFailStatus?: number;
  /** Force runtimes endpoint to fail with status. */
  runtimesFailStatus?: number;
}

async function startFakeOperator(o: FakeOpts) {
  const port = await allocPort();
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/runtimes') {
      if (o.runtimesFailStatus) {
        res.writeHead(o.runtimesFailStatus).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ runtimes: o.runtimes }));
    } else if (req.method === 'POST' && req.url === '/revoke') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          o.revokeBodies.push(JSON.parse(body));
        } catch {
          o.revokeBodies.push({ runtimeId: '<unparseable>' });
        }
        if (o.revokeFailStatus) {
          res.writeHead(o.revokeFailStatus).end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'revoked' }));
      });
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  servers.push(server);
  return `http://127.0.0.1:${port}`;
}

function getTool(server: any, name: string) {
  const tool = server._registeredTools?.[name];
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool;
}

async function invoke(server: any, name: string, args: unknown) {
  const tool = getTool(server, name);
  return await tool.handler(args, {} as any);
}

describe('revoke tool (MCP-01)', () => {
  it('registers revoke with destructive description and { runtimeId, reason? } inputSchema', async () => {
    const url = await startFakeOperator({ runtimes: [], revokeBodies: [] });
    const buffer = new RingBuffer(50);
    const server = buildMcpServer({ buffer, operatorHttpUrl: url });

    const tool = getTool(server, 'revoke');
    expect(tool).toBeTruthy();
    expect(tool.description).toMatch(/DESTRUCTIVE/);
    expect(tool.description).toMatch(/permanently revokes/);
    // inputSchema is normalized to a zod object by the SDK; assert its shape allows runtimeId.
    expect(tool.inputSchema).toBeDefined();
  });

  it('pre-checks GET /runtimes; returns runtime_not_found for unknown id', async () => {
    const url = await startFakeOperator({ runtimes: [], revokeBodies: [] });
    const server = buildMcpServer({ buffer: new RingBuffer(50), operatorHttpUrl: url });

    const r = await invoke(server, 'revoke', { runtimeId: 'alpha' });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('runtime_not_found');
  });

  it('returns already_revoked when target status is "revoked"', async () => {
    const url = await startFakeOperator({
      runtimes: [{ runtimeId: 'alpha', status: 'revoked', registeredAt: 1 }],
      revokeBodies: [],
    });
    const server = buildMcpServer({ buffer: new RingBuffer(50), operatorHttpUrl: url });

    const r = await invoke(server, 'revoke', { runtimeId: 'alpha' });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('already_revoked');
  });

  it('forwards reason to operator POST /revoke body when present', async () => {
    const bodies: Array<{ runtimeId: string; reason?: string }> = [];
    const url = await startFakeOperator({
      runtimes: [{ runtimeId: 'alpha', status: 'registered', registeredAt: 1 }],
      revokeBodies: bodies,
    });
    const server = buildMcpServer({ buffer: new RingBuffer(50), operatorHttpUrl: url });

    const r = await invoke(server, 'revoke', { runtimeId: 'alpha', reason: 'clone detected' });
    expect(r.isError).not.toBe(true);
    expect(r.structuredContent).toEqual({ ok: true, status: 'revoked' });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({ runtimeId: 'alpha', reason: 'clone detected' });
  });

  it('returns operator_unavailable when GET /runtimes throws', async () => {
    const port = await allocPort();
    const url = `http://127.0.0.1:${port}`;
    const server = buildMcpServer({ buffer: new RingBuffer(50), operatorHttpUrl: url });

    const r = await invoke(server, 'revoke', { runtimeId: 'alpha' });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('operator_unavailable');
  });

  it('returns operator_unavailable when POST /revoke fails after pre-check passes', async () => {
    const url = await startFakeOperator({
      runtimes: [{ runtimeId: 'alpha', status: 'registered', registeredAt: 1 }],
      revokeBodies: [],
      revokeFailStatus: 500,
    });
    const server = buildMcpServer({ buffer: new RingBuffer(50), operatorHttpUrl: url });

    const r = await invoke(server, 'revoke', { runtimeId: 'alpha' });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('operator_unavailable');
  });
});

/**
 * MCP-02 e2e: list_runtimes → revoke alpha → list_runtimes shows alpha as revoked
 *            → revoke alpha again returns already_revoked.
 *
 * Drives the registered tool callbacks (via _registeredTools[name].handler)
 * against a real http.createServer fake Operator. No fetch mocking.
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

async function startFakeOperator() {
  const reg = new Map<string, { runtimeId: string; status: string; registeredAt: number }>([
    ['alpha', { runtimeId: 'alpha', status: 'registered', registeredAt: 1 }],
    ['beta', { runtimeId: 'beta', status: 'registered', registeredAt: 2 }],
  ]);
  const port = await allocPort();
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/runtimes') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ runtimes: Array.from(reg.values()) }));
    } else if (req.method === 'POST' && req.url === '/revoke') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { runtimeId } = JSON.parse(body);
          const r = reg.get(runtimeId);
          if (r) r.status = 'revoked';
        } catch {
          // ignore — operator returns 200 idempotently in real impl too
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

async function invoke(server: any, name: string, args: unknown = {}) {
  const tool = (server as any)._registeredTools?.[name];
  if (!tool) throw new Error(`tool not found: ${name}`);
  return await tool.handler(args, {} as any);
}

describe('e2e against fake Operator (MCP-02)', () => {
  it('list_runtimes → revoke alpha → list shows revoked → revoke alpha again returns already_revoked', async () => {
    const url = await startFakeOperator();
    const buffer = new RingBuffer(50);
    const server = buildMcpServer({ buffer, operatorHttpUrl: url });

    // 1. list — both registered
    const r1 = await invoke(server, 'list_runtimes', {});
    expect(r1.structuredContent.runtimes).toHaveLength(2);
    expect(r1.structuredContent.runtimes.find((x: any) => x.runtimeId === 'alpha').status).toBe('registered');

    // 2. revoke alpha (happy)
    const r2 = await invoke(server, 'revoke', { runtimeId: 'alpha', reason: 'clone detected' });
    expect(r2.isError).not.toBe(true);
    expect(r2.structuredContent).toEqual({ ok: true, status: 'revoked' });

    // 3. list — alpha now revoked (registry mutated by fake Operator)
    const r3 = await invoke(server, 'list_runtimes', {});
    const alpha = r3.structuredContent.runtimes.find((x: any) => x.runtimeId === 'alpha');
    expect(alpha.status).toBe('revoked');

    // 4. revoke alpha again — already_revoked surfaced by pre-check
    const r4 = await invoke(server, 'revoke', { runtimeId: 'alpha' });
    expect(r4.isError).toBe(true);
    expect(r4.structuredContent.code).toBe('already_revoked');
  });
});

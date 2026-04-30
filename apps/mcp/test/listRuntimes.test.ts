/**
 * list_runtimes tool unit tests (MCP-01).
 *
 * Test seam: invokes the registered tool's `.handler(args, extra)` directly via
 * `(server as any)._registeredTools[name]`. The SDK 1.29 stores registered tools
 * on this internal map (verified in dist/esm/server/mcp.js line 19/649).
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

async function startFakeOperator(routes: {
  runtimes?: () => unknown;
  runtimesStatus?: number;
}) {
  const port = await allocPort();
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/runtimes') {
      if (routes.runtimesStatus && routes.runtimesStatus >= 400) {
        res.writeHead(routes.runtimesStatus).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(routes.runtimes ? routes.runtimes() : { runtimes: [] }));
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
  if (!tool) throw new Error(`tool not found: ${name} (keys=${Object.keys(server._registeredTools ?? {})})`);
  return tool;
}

async function invoke(server: any, name: string, args: unknown = {}) {
  const tool = getTool(server, name);
  // SDK calls handler(args, extra) when inputSchema is set; tests don't need extra.
  return await tool.handler(args, {} as any);
}

describe('list_runtimes tool (MCP-01)', () => {
  it('registers list_runtimes with empty inputSchema and structuredContent.runtimes passthrough', async () => {
    const url = await startFakeOperator({
      runtimes: () => ({
        runtimes: [
          { runtimeId: 'alpha', status: 'registered', registeredAt: 1 },
          { runtimeId: 'beta', status: 'awaiting', registeredAt: 2 },
        ],
      }),
    });
    const buffer = new RingBuffer(50);
    const server = buildMcpServer({ buffer, operatorHttpUrl: url });

    const tool = getTool(server, 'list_runtimes');
    expect(tool).toBeTruthy();
    expect(tool.description).toMatch(/operator/i);

    const r = await invoke(server, 'list_runtimes', {});
    expect(r.structuredContent.runtimes).toHaveLength(2);
    expect(r.structuredContent.runtimes[0].runtimeId).toBe('alpha');
    expect(r.content[0].text).toMatch(/2 runtime/);
    expect(r.isError).not.toBe(true);
  });

  it('returns mcpError operator_unavailable when fetch throws', async () => {
    // Allocate then immediately release a port → ECONNREFUSED.
    const port = await allocPort();
    const url = `http://127.0.0.1:${port}`;
    const buffer = new RingBuffer(50);
    const server = buildMcpServer({ buffer, operatorHttpUrl: url });

    const r = await invoke(server, 'list_runtimes', {});
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('operator_unavailable');
    expect(r.structuredContent.ok).toBe(false);
  });
});

/**
 * run_rotation tool integration tests (Plan 05-05 Task 2).
 *
 * Stands up TWO fake HTTP servers per test: a fake KeeperHub /api/workflow/{id}/execute
 * endpoint and a fake apps/keeperhub poller /poller/register endpoint. Verifies
 * the tool wires both together correctly, surfaces structured errors via mcpError,
 * and degrades gracefully when only the poller is unreachable.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as http from 'node:http';
import { allocPort } from './setup.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRunRotation, type RunRotationCtx } from '../src/tools/runRotation.js';

const servers: http.Server[] = [];

afterEach(async () => {
  for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
  servers.length = 0;
});

interface CapturedReq {
  method?: string;
  url?: string;
  auth?: string;
  body?: string;
}

interface FakeServer {
  url: string;
  port: number;
  received: CapturedReq[];
}

async function startFakeKeeperhub(opts: {
  workflowId: string;
  status?: number;
  responseBody?: unknown;
}): Promise<FakeServer> {
  const received: CapturedReq[] = [];
  const port = await allocPort();
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        auth: req.headers['authorization'] as string | undefined,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      const expectedUrl = `/api/workflow/${opts.workflowId}/execute`;
      if (req.method === 'POST' && req.url === expectedUrl) {
        res.writeHead(opts.status ?? 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(opts.responseBody ?? { executionId: 'run_default' }));
      } else {
        res.writeHead(404).end();
      }
    });
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  servers.push(server);
  return { url: `http://127.0.0.1:${port}`, port, received };
}

async function startFakePoller(opts: { status?: number } = {}): Promise<FakeServer> {
  const received: CapturedReq[] = [];
  const port = await allocPort();
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        auth: req.headers['authorization'] as string | undefined,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      if (req.method === 'POST' && req.url === '/poller/register') {
        res.writeHead(opts.status ?? 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'registered', active: 1 }));
      } else {
        res.writeHead(404).end();
      }
    });
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  servers.push(server);
  return { url: `http://127.0.0.1:${port}`, port, received };
}

function buildServer(ctx: RunRotationCtx) {
  const server = new McpServer({ name: 'sonar-test', version: '0.0.0' });
  registerRunRotation(server, ctx);
  return server;
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

describe('run_rotation tool', () => {
  let kh: FakeServer;
  let poller: FakeServer;

  beforeEach(async () => {
    kh = await startFakeKeeperhub({
      workflowId: 'wf_test',
      responseBody: { executionId: 'run_001' },
    });
    poller = await startFakePoller();
  });

  it('happy path: triggers KeeperHub, registers with poller, returns runId + walletCount + pollerRegistered:true', async () => {
    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: 'tok',
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });

    const r = await invoke(server, 'run_rotation', {
      runtimeIds: ['alpha', 'beta', 'gamma'],
    });

    expect(r.isError).not.toBe(true);
    expect(r.structuredContent.runId).toBe('run_001');
    expect(r.structuredContent.runtimeIds).toEqual(['alpha', 'beta', 'gamma']);
    expect(r.structuredContent.walletCount).toBe(3);
    expect(r.structuredContent.pollerRegistered).toBe(true);

    expect(kh.received).toHaveLength(1);
    expect(kh.received[0]!.method).toBe('POST');
    expect(kh.received[0]!.url).toBe('/api/workflow/wf_test/execute');
    expect(kh.received[0]!.auth).toBe('Bearer tok');
    expect(JSON.parse(kh.received[0]!.body!)).toEqual({
      input: { runtimeIds: ['alpha', 'beta', 'gamma'] },
    });

    expect(poller.received).toHaveLength(1);
    expect(poller.received[0]!.url).toBe('/poller/register');
    expect(poller.received[0]!.auth).toBe('Bearer wh');
    expect(JSON.parse(poller.received[0]!.body!)).toEqual({ runId: 'run_001' });
  });

  it('rejects empty runtimeIds before any HTTP call', async () => {
    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: 'tok',
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });

    // The MCP SDK validates inputSchema before invoking the handler — calling the handler
    // directly with invalid args produces an empty-array result; safer to assert:
    // when the handler IS called with `{runtimeIds: []}`, the underlying schema would
    // normally have rejected. Since handler() bypasses the schema, we test the boundary
    // by asserting the SDK's parsed inputSchema rejects []:
    const tool = getTool(server, 'run_rotation');
    const inputSchema = tool.inputSchema; // SDK normalizes to a ZodObject
    // Using safeParse — `min(1)` should reject [].
    const parsed = inputSchema.safeParse({ runtimeIds: [] });
    expect(parsed.success).toBe(false);

    expect(kh.received).toHaveLength(0);
    expect(poller.received).toHaveLength(0);
  });

  it('returns mcpError keeperhub_unavailable on KeeperHub 401', async () => {
    // Stop the default 200 KH stub and replace with a 401 stub.
    await new Promise<void>((r) => servers[0]!.close(() => r()));
    servers.shift();
    kh = await startFakeKeeperhub({
      workflowId: 'wf_test',
      status: 401,
      responseBody: { error: 'unauthorized' },
    });

    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: 'bad-tok',
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });

    const r = await invoke(server, 'run_rotation', { runtimeIds: ['x'] });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('keeperhub_unavailable');
    expect(r.content[0].text).toMatch(/401/);
    // Poller was never contacted on KH failure.
    expect(poller.received).toHaveLength(0);
  });

  it('returns mcpError keeperhub_unavailable on network failure (KH server killed)', async () => {
    // Pre-allocate a port and DON'T listen on it.
    const port = await allocPort();
    const server = buildServer({
      apiBaseUrl: `http://127.0.0.1:${port}`,
      apiToken: 'tok',
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });

    const r = await invoke(server, 'run_rotation', { runtimeIds: ['x'] });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('keeperhub_unavailable');
    expect(r.content[0].text).toMatch(/network/);
    expect(poller.received).toHaveLength(0);
  });

  it('poller down: returns success with pollerRegistered:false (does NOT mcpError)', async () => {
    // Stop only the poller stub (started 2nd in beforeEach → index 1).
    await new Promise<void>((r) => servers[1]!.close(() => r()));
    servers.splice(1, 1);

    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: 'tok',
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url, // same URL but server is dead now
      webhookSecret: 'wh',
    });

    const r = await invoke(server, 'run_rotation', { runtimeIds: ['alpha'] });
    expect(r.isError).not.toBe(true);
    expect(r.structuredContent.runId).toBe('run_001');
    expect(r.structuredContent.pollerRegistered).toBe(false);
    expect(r.content[0].text).toMatch(/Warning|warning/);
  });

  it('not configured: empty apiToken → mcpError before any HTTP call', async () => {
    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: '', // not configured
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });

    const r = await invoke(server, 'run_rotation', { runtimeIds: ['alpha'] });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('keeperhub_not_configured');
    expect(kh.received).toHaveLength(0);
    expect(poller.received).toHaveLength(0);
  });

  it('not configured: empty workflowId → mcpError before any HTTP call', async () => {
    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: 'tok',
      workflowId: '',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });

    const r = await invoke(server, 'run_rotation', { runtimeIds: ['alpha'] });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('keeperhub_not_configured');
    expect(kh.received).toHaveLength(0);
    expect(poller.received).toHaveLength(0);
  });

  it('description marks the tool DESTRUCTIVE', () => {
    const server = buildServer({
      apiBaseUrl: kh.url,
      apiToken: 'tok',
      workflowId: 'wf_test',
      pollerBaseUrl: poller.url,
      webhookSecret: 'wh',
    });
    const tool = getTool(server, 'run_rotation');
    expect(tool.description).toMatch(/DESTRUCTIVE/);
  });
});

/**
 * KeeperHub HTTP client (Plan 05-05 Task 1).
 *
 * Real KeeperHub run-trigger endpoint (verified against the KeeperHub MCP client
 * source github.com/KeeperHub/mcp/src/client/keeperhub.ts):
 *
 *   POST {apiBaseUrl}/api/workflow/{workflowId}/execute   (SINGULAR `workflow`)
 *     Header: Authorization: Bearer {apiToken}
 *     Body:   { input: { runtimeIds: string[] } }
 *     Response 2xx: { id?: string, executionId?: string, runId?: string }
 *
 * The plan's pseudo-code referenced `/api/workflows/{id}/runs` and a `runId` field —
 * both are wrong for the real API. Corrected per the user-supplied note.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { triggerKeeperhubRun, type KeeperhubCtx } from '../src/keeperhub/http.js';

interface CapturedReq {
  method?: string;
  url?: string;
  auth?: string;
  contentType?: string;
  body?: string;
}

interface StubServer {
  server: Server;
  port: number;
  received: CapturedReq;
  setResponder: (
    fn: (req: IncomingMessage, res: ServerResponse, body: string) => void,
  ) => void;
}

async function startStub(): Promise<StubServer> {
  const received: CapturedReq = {};
  let responder: (req: IncomingMessage, res: ServerResponse, body: string) => void = (
    _req,
    res,
  ) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ executionId: 'run_default' }));
  };
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.method = req.method;
      received.url = req.url;
      received.auth = req.headers['authorization'] as string | undefined;
      received.contentType = req.headers['content-type'] as string | undefined;
      received.body = Buffer.concat(chunks).toString('utf8');
      responder(req, res, received.body);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  return {
    server,
    port,
    received,
    setResponder: (fn) => {
      responder = fn;
    },
  };
}

async function stop(s: StubServer): Promise<void> {
  await new Promise<void>((r) => s.server.close(() => r()));
}

const baseCtx = (port: number): KeeperhubCtx => ({
  apiBaseUrl: `http://127.0.0.1:${port}`,
  apiToken: 'kh-tok',
  workflowId: 'wf_xyz',
});

describe('triggerKeeperhubRun', () => {
  let stub: StubServer;
  beforeEach(async () => {
    stub = await startStub();
  });
  afterEach(async () => {
    await stop(stub);
  });

  it('POSTs to /api/workflow/{workflowId}/execute with Bearer auth and { input } body', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ executionId: 'run_001' }));
    });
    const out = await triggerKeeperhubRun(baseCtx(stub.port), {
      runtimeIds: ['alpha', 'beta', 'gamma'],
    });
    expect(out.runId).toBe('run_001');
    expect(stub.received.method).toBe('POST');
    expect(stub.received.url).toBe('/api/workflow/wf_xyz/execute');
    expect(stub.received.auth).toBe('Bearer kh-tok');
    expect(stub.received.contentType).toMatch(/application\/json/);
    const body = JSON.parse(stub.received.body!);
    expect(body).toEqual({ input: { runtimeIds: ['alpha', 'beta', 'gamma'] } });
  });

  it('accepts response with `executionId` field', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ executionId: 'exec_alpha' }));
    });
    const out = await triggerKeeperhubRun(baseCtx(stub.port), { runtimeIds: ['x'] });
    expect(out.runId).toBe('exec_alpha');
  });

  it('accepts response with `id` field as fallback', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'fallback_id' }));
    });
    const out = await triggerKeeperhubRun(baseCtx(stub.port), { runtimeIds: ['x'] });
    expect(out.runId).toBe('fallback_id');
  });

  it('throws http_401 on 401 unauthorized', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'unauthorized' }));
    });
    await expect(
      triggerKeeperhubRun(baseCtx(stub.port), { runtimeIds: ['x'] }),
    ).rejects.toThrow(/http_401/);
  });

  it('throws http_404 on 404 workflow not found', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await expect(
      triggerKeeperhubRun(baseCtx(stub.port), { runtimeIds: ['x'] }),
    ).rejects.toThrow(/http_404/);
  });

  it('throws http_network on network failure (server killed)', async () => {
    const port = stub.port;
    await stop(stub);
    // Restart a no-op server then close to keep cleanup happy
    stub = await startStub();
    await expect(
      triggerKeeperhubRun(
        { apiBaseUrl: `http://127.0.0.1:${port}`, apiToken: 't', workflowId: 'wf' },
        { runtimeIds: ['x'] },
      ),
    ).rejects.toThrow(/http_network/);
  });

  it('throws http_invalid_response when neither runId/id/executionId present', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'queued' }));
    });
    await expect(
      triggerKeeperhubRun(baseCtx(stub.port), { runtimeIds: ['x'] }),
    ).rejects.toThrow(/http_invalid_response/);
  });
});

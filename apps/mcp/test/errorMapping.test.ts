/**
 * HTTP wrapper coverage for apps/mcp/src/operator/http.ts.
 * Uses real http.createServer fixtures (no fetch mocks) per Plan 04-02.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { allocPort } from './setup.js';
import { listRuntimes, revoke } from '../src/operator/http.js';

let server: http.Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

async function spinUp(handler: http.RequestListener): Promise<{ baseUrl: string }> {
  const port = await allocPort();
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', () => resolve()));
  const addr = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${addr.port}` };
}

describe('operator/http listRuntimes (MCP-02)', () => {
  it('GETs /runtimes and returns parsed body on 200', async () => {
    const payload = {
      runtimes: [
        { runtimeId: 'alpha', status: 'registered', registeredAt: 1000 },
        { runtimeId: 'beta', status: 'revoked', registeredAt: 2000 },
      ],
    };
    const { baseUrl } = await spinUp((req, res) => {
      expect(req.method).toBe('GET');
      expect(req.url).toBe('/runtimes');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });

    const result = await listRuntimes(baseUrl);
    expect(result).toEqual(payload);
  });

  it('throws Error(http_500) on 5xx', async () => {
    const { baseUrl } = await spinUp((_req, res) => {
      res.writeHead(500);
      res.end('boom');
    });

    await expect(listRuntimes(baseUrl)).rejects.toThrow(/http_500/);
  });

  it('rejects on ECONNREFUSED (operator not running)', async () => {
    const port = await allocPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    // Nothing is bound on that port → fetch should reject.
    await expect(listRuntimes(baseUrl)).rejects.toBeInstanceOf(Error);
  });
});

describe('operator/http revoke (MCP-02)', () => {
  it('POSTs JSON body to /revoke and returns parsed body on 200', async () => {
    const seen: { method?: string; url?: string; contentType?: string; body?: string } = {};
    const { baseUrl } = await spinUp((req, res) => {
      seen.method = req.method;
      seen.url = req.url;
      seen.contentType = req.headers['content-type'];
      let body = '';
      req.on('data', (chunk) => (body += chunk.toString()));
      req.on('end', () => {
        seen.body = body;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'revoked' }));
      });
    });

    const result = await revoke(baseUrl, { runtimeId: 'alpha', reason: 'test' });

    expect(seen.method).toBe('POST');
    expect(seen.url).toBe('/revoke');
    expect(seen.contentType).toBe('application/json');
    expect(JSON.parse(seen.body!)).toEqual({ runtimeId: 'alpha', reason: 'test' });
    expect(result).toEqual({ status: 'revoked' });
  });

  it('throws Error(http_400) on 400', async () => {
    const { baseUrl } = await spinUp((_req, res) => {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request' }));
    });

    await expect(revoke(baseUrl, { runtimeId: 'alpha' })).rejects.toThrow(/http_400/);
  });
});

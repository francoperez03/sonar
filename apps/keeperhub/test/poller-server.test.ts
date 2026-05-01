/**
 * poller-server.ts — tiny localhost HTTP register endpoint (Plan 05-05 D-20).
 *
 * Routes:
 *   GET  /healthz         → 200 { status: 'ok' } (no auth)
 *   POST /poller/register → 200 { status: 'registered', active } (bearer-authed)
 *   anything else         → 404
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { startPollerServer } from '../src/poller-server.js';
import { runRegistry } from '../src/runRegistry.js';

const SECRET = 'wh-secret';

let server: Server;
let port: number;

async function findPort(): Promise<number> {
  const { createServer } = await import('node:net');
  return await new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (addr && typeof addr !== 'string') {
        const p = addr.port;
        s.close(() => resolve(p));
      } else reject(new Error('no port'));
    });
  });
}

beforeEach(async () => {
  for (const id of runRegistry.active()) runRegistry.remove(id);
  port = await findPort();
  server = startPollerServer({ port, webhookSecret: SECRET });
  // wait for listening
  await new Promise<void>((r) => {
    if (server.listening) r();
    else server.once('listening', () => r());
  });
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  for (const id of runRegistry.active()) runRegistry.remove(id);
});

const url = (path: string) => `http://127.0.0.1:${port}${path}`;

describe('poller-server', () => {
  it('GET /healthz returns 200 ok with no auth required', async () => {
    const res = await fetch(url('/healthz'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('POST /poller/register with valid bearer adds runId to runRegistry', async () => {
    const res = await fetch(url('/poller/register'), {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ runId: 'run_abc' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'registered', active: 1 });
    expect(runRegistry.has('run_abc')).toBe(true);
  });

  it('POST /poller/register without bearer returns 401', async () => {
    const res = await fetch(url('/poller/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: 'run_abc' }),
    });
    expect(res.status).toBe(401);
    expect(runRegistry.has('run_abc')).toBe(false);
  });

  it('POST /poller/register with wrong bearer returns 401', async () => {
    const res = await fetch(url('/poller/register'), {
      method: 'POST',
      headers: {
        'authorization': 'Bearer wrong-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ runId: 'run_abc' }),
    });
    expect(res.status).toBe(401);
    expect(runRegistry.has('run_abc')).toBe(false);
  });

  it('POST /poller/register with invalid JSON returns 400', async () => {
    const res = await fetch(url('/poller/register'), {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('POST /poller/register with missing runId returns 400', async () => {
    const res = await fetch(url('/poller/register'), {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(runRegistry.active().length).toBe(0);
  });

  it('POST /poller/register with empty-string runId returns 400', async () => {
    const res = await fetch(url('/poller/register'), {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ runId: '' }),
    });
    expect(res.status).toBe(400);
    expect(runRegistry.active().length).toBe(0);
  });

  it('unknown URL returns 404', async () => {
    const res = await fetch(url('/nope'), {
      method: 'GET',
    });
    expect(res.status).toBe(404);
  });

  it('GET /poller/register (wrong method) returns 404', async () => {
    const res = await fetch(url('/poller/register'), { method: 'GET' });
    expect(res.status).toBe(404);
  });

  it('multiple registers accumulate active count', async () => {
    for (const id of ['a', 'b', 'c']) {
      const res = await fetch(url('/poller/register'), {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ runId: id }),
      });
      expect(res.status).toBe(200);
    }
    expect(runRegistry.active().sort()).toEqual(['a', 'b', 'c']);
  });
});

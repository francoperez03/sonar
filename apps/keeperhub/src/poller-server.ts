/**
 * Tiny localhost HTTP register endpoint. Per CONTEXT D-20.
 *
 * Bridges apps/mcp (Claude Desktop stdio child) and the long-lived poll-execution
 * process so a freshly-triggered runId reaches runRegistry.add() in this process.
 *
 * Bound to 127.0.0.1 only — never LAN-exposed. Bearer-authed via the same shared
 * KEEPERHUB_WEBHOOK_SECRET as the Operator's /rotation/log-ingest envelope, with
 * `crypto.timingSafeEqual` for constant-time comparison (Plan 03 idiom).
 */
import { createServer, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { runRegistry } from './runRegistry.js';
import { log } from './util/log.js';

export interface PollerServerOpts {
  port: number;
  webhookSecret: string;
}

export function startPollerServer(opts: PollerServerOpts): Server {
  const expectedAuth = Buffer.from(`Bearer ${opts.webhookSecret}`, 'utf8');

  const server = createServer((req, res) => {
    // GET /healthz — no auth, used by smoke runs (`curl -sf .../healthz`).
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Anything other than POST /poller/register → 404.
    if (req.method !== 'POST' || req.url !== '/poller/register') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    // Constant-time bearer check.
    const got = Buffer.from(String(req.headers['authorization'] ?? ''), 'utf8');
    if (got.length !== expectedAuth.length || !timingSafeEqual(got, expectedAuth)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let body: { runId?: unknown };
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { runId?: unknown };
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
        return;
      }
      if (typeof body.runId !== 'string' || !body.runId) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return;
      }
      runRegistry.add(body.runId);
      const active = runRegistry.active().length;
      log({ msg: 'run_registered', runId: body.runId, active });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'registered', active }));
    });
  });

  server.listen(opts.port, '127.0.0.1', () => {
    log({ msg: 'poller_server_listening', port: opts.port });
  });
  return server;
}

/**
 * POST /log/publish — Phase 6 D-07 ChatMsg ingestion tests.
 *
 * Mirrors the rotation.routes harness style (in-process express + LogBus
 * subscriber). Asserts bearer-auth, zod validation, and LogBus emit.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { jsonBody } from '../src/http/middleware/json.js';
import { bearerAuth } from '../src/http/middleware/bearerAuth.js';
import { logPublishRoute } from '../src/http/routes/log/publish.js';
import { LogBus } from '../src/log/LogBus.js';
import { allocPort } from './setup.js';
import type { ChatMsg, LogEntryMsg, StatusChangeMsg } from '@sonar/shared';
import { ChatMsg as ChatMsgSchema } from '@sonar/shared';

const SECRET = 'test-secret';
const AUTH_HEADER = `Bearer ${SECRET}`;

let httpServer: Server | undefined;

afterEach(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    httpServer = undefined;
  }
});

interface Harness {
  port: number;
  logBus: LogBus;
  events: Array<LogEntryMsg | StatusChangeMsg | ChatMsg>;
  unsubscribe: () => void;
}

async function spinUp(): Promise<Harness> {
  const port = await allocPort();
  const logBus = new LogBus();
  const events: Array<LogEntryMsg | StatusChangeMsg | ChatMsg> = [];
  const unsubscribe = logBus.subscribe((e) => events.push(e));

  const app = express();
  app.use(jsonBody);
  const auth = bearerAuth(SECRET);
  app.post('/log/publish', auth, logPublishRoute({ logBus }));

  const srv = createHttpServer(app);
  await new Promise<void>((r) => srv.listen(port, '127.0.0.1', () => r()));
  httpServer = srv;
  return { port, logBus, events, unsubscribe };
}

function postJson(port: number, path: string, body: unknown, opts: { auth?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth !== null) headers['authorization'] = opts.auth ?? AUTH_HEADER;
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /log/publish (Phase 6 D-07)', () => {
  it('401 on missing bearer', async () => {
    const { port, events } = await spinUp();
    const valid: ChatMsg = { type: 'chat', role: 'user', content: 'hi', timestamp: Date.now() };
    const res = await postJson(port, '/log/publish', valid, { auth: null });
    expect(res.status).toBe(401);
    expect(events).toHaveLength(0);
  });

  it('401 on wrong bearer', async () => {
    const { port, events } = await spinUp();
    const valid: ChatMsg = { type: 'chat', role: 'user', content: 'hi', timestamp: Date.now() };
    const res = await postJson(port, '/log/publish', valid, { auth: 'Bearer wrong' });
    expect(res.status).toBe(401);
    expect(events).toHaveLength(0);
  });

  it('400 on malformed body (role=system)', async () => {
    const { port, events } = await spinUp();
    const res = await postJson(port, '/log/publish', {
      type: 'chat',
      role: 'system',
      content: 'hi',
      timestamp: Date.now(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_request');
    expect(events).toHaveLength(0);
  });

  it('400 on empty content', async () => {
    const { port, events } = await spinUp();
    const res = await postJson(port, '/log/publish', {
      type: 'chat',
      role: 'user',
      content: '',
      timestamp: Date.now(),
    });
    expect(res.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it('400 on missing type discriminator', async () => {
    const { port, events } = await spinUp();
    const res = await postJson(port, '/log/publish', { role: 'user', content: 'hi', timestamp: 1 });
    expect(res.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it('200 + emits a single ChatMsg on LogBus when bearer + body valid', async () => {
    const { port, events } = await spinUp();
    const valid: ChatMsg = {
      type: 'chat',
      role: 'assistant',
      content: 'Found 3 runtimes',
      timestamp: 1714579200000,
    };
    const res = await postJson(port, '/log/publish', valid);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('published');
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.type).toBe('chat');
    // Round-trips zod parse — guarantees emitted shape matches the contract.
    const parsed = ChatMsgSchema.safeParse(e);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual(valid);
  });
});

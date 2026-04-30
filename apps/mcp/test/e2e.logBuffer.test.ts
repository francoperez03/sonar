/**
 * MCP-02 e2e: a frame pushed by a fake /logs WS appears in get_workflow_log
 * snapshot. Mirrors the Phase 3 broadcast test cleanup pattern (terminate
 * active client sockets before closing the server, per Plan 02 SUMMARY hygiene).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { allocPort } from './setup.js';
import { RingBuffer } from '../src/buffer/RingBuffer.js';
import { buildMcpServer } from '../src/mcpServer.js';
import { connectLogs } from '../src/operator/logs.js';

const servers: WebSocketServer[] = [];
const handles: Array<{ stop: () => void }> = [];

afterEach(async () => {
  for (const h of handles) h.stop();
  handles.length = 0;
  for (const wss of servers) {
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((r) => wss.close(() => r()));
  }
  servers.length = 0;
});

async function startFakeLogsServer(send: () => string | string[]) {
  const port = await allocPort();
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  wss.on('connection', (ws) => {
    const out = send();
    const frames = Array.isArray(out) ? out : [out];
    for (const f of frames) ws.send(f);
  });
  servers.push(wss);
  // wait for listening
  await new Promise<void>((r) => {
    if (wss.options.port !== undefined) r();
    else wss.on('listening', () => r());
  });
  return { url: `ws://127.0.0.1:${port}` };
}

async function invoke(server: any, name: string, args: unknown = {}) {
  const tool = (server as any)._registeredTools?.[name];
  if (!tool) throw new Error(`tool not found: ${name}`);
  return await tool.handler(args, {} as any);
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe('e2e log capture (MCP-02)', () => {
  it('frame pushed by fake /logs WS appears in get_workflow_log; runtimeId filter applied', async () => {
    const frame = JSON.stringify({
      type: 'log_entry',
      runtimeId: 'beta',
      level: 'info',
      message: 'hello-from-operator',
      timestamp: 12345,
    });
    const { url } = await startFakeLogsServer(() => frame);

    const buffer = new RingBuffer(50);
    handles.push(connectLogs({ url, buffer }));

    // wait until the frame lands in the buffer
    await waitFor(() => buffer.snapshot({}, 50).length === 1);

    const server = buildMcpServer({ buffer, operatorHttpUrl: 'http://localhost:8787' });

    const r1 = await invoke(server, 'get_workflow_log', { runtimeId: 'beta', limit: 50 });
    expect(r1.structuredContent.events).toHaveLength(1);
    expect(r1.structuredContent.events[0].runtimeId).toBe('beta');
    expect(r1.structuredContent.events[0].message).toBe('hello-from-operator');

    const r2 = await invoke(server, 'get_workflow_log', { runtimeId: 'gamma' });
    expect(r2.structuredContent.events).toHaveLength(0);
  });
});

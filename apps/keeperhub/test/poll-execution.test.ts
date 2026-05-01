import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pollOnce, mainLoop, createPollState, type PollDeps } from '../src/poll-execution.js';
import { runRegistry } from '../src/runRegistry.js';

interface Handlers {
  runs: (req: IncomingMessage, res: ServerResponse, body: string) => void;
  ingest: (req: IncomingMessage, res: ServerResponse, body: string) => void;
  complete: (req: IncomingMessage, res: ServerResponse, body: string) => void;
}

interface StubServer {
  server: Server;
  port: number;
  handlers: Handlers;
  ingestCalls: Array<{ body: unknown; auth: string | undefined }>;
  completeCalls: Array<{ body: unknown; auth: string | undefined }>;
  runsCalls: Array<{ url: string; auth: string | undefined }>;
}

function defaultHandlers(s: StubServer): Handlers {
  return {
    runs: (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ execution: { status: 'running' }, logs: [] }));
    },
    ingest: (_req, res, body) => {
      try {
        s.ingestCalls.push({ body: JSON.parse(body), auth: _req.headers['authorization'] as string | undefined });
      } catch {
        s.ingestCalls.push({ body, auth: _req.headers['authorization'] as string | undefined });
      }
      res.writeHead(200);
      res.end();
    },
    complete: (_req, res, body) => {
      try {
        s.completeCalls.push({ body: JSON.parse(body), auth: _req.headers['authorization'] as string | undefined });
      } catch {
        s.completeCalls.push({ body, auth: _req.headers['authorization'] as string | undefined });
      }
      res.writeHead(200);
      res.end();
    },
  };
}

async function startStub(): Promise<StubServer> {
  const stub: StubServer = {
    server: null as unknown as Server,
    port: 0,
    handlers: null as unknown as Handlers,
    ingestCalls: [],
    completeCalls: [],
    runsCalls: [],
  };
  stub.handlers = defaultHandlers(stub);
  stub.server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const url = req.url ?? '';
      if (url.startsWith('/api/workflows/executions/')) {
        stub.runsCalls.push({ url, auth: req.headers['authorization'] as string | undefined });
        stub.handlers.runs(req, res, body);
      } else if (url === '/rotation/log-ingest') {
        stub.handlers.ingest(req, res, body);
      } else if (url === '/rotation/complete') {
        stub.handlers.complete(req, res, body);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });
  await new Promise<void>((r) => stub.server.listen(0, '127.0.0.1', () => r()));
  stub.port = (stub.server.address() as { port: number }).port;
  return stub;
}

async function stop(s: StubServer): Promise<void> {
  await new Promise<void>((r) => s.server.close(() => r()));
}

const TX1 = '0x' + 'a'.repeat(64);
const TX2 = '0x' + 'b'.repeat(64);
const DEPRECATE_TX = '0x' + 'c'.repeat(64);

const baseDeps = (port: number): PollDeps => ({
  apiBaseUrl: `http://127.0.0.1:${port}`,
  apiToken: 'tok',
  operatorBaseUrl: `http://127.0.0.1:${port}`,
  webhookSecret: 'wh',
});

describe('pollOnce', () => {
  let stub: StubServer;
  beforeEach(async () => {
    stub = await startStub();
    for (const id of runRegistry.active()) runRegistry.remove(id);
  });
  afterEach(async () => {
    await stop(stub);
  });

  it('forwards every fresh tx_hash as a LogEntryMsg with the basescan explorer URL', async () => {
    stub.handlers.runs = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          execution: { status: 'running' },
          logs: [
            { nodeId: 'transfer', output: { tx_hash: TX1 } },
            { nodeId: 'write', output: { tx_hash: TX2 } },
          ],
        }),
      );
    };
    const state = createPollState();
    const result = await pollOnce('run-1', baseDeps(stub.port), state);
    expect(result.done).toBe(false);
    expect(stub.ingestCalls.length).toBe(2);
    const msgs = stub.ingestCalls.map((c) => (c.body as { message: string }).message);
    expect(msgs[0]).toContain(`tx_sent:transfer:${TX1}:https://sepolia.basescan.org/tx/${TX1}`);
    expect(msgs[1]).toContain(`tx_sent:write:${TX2}:https://sepolia.basescan.org/tx/${TX2}`);
    expect(stub.ingestCalls[0]!.auth).toBe('Bearer wh');
  });

  it('does not re-forward the same tx_hash on subsequent polls (per-run dedup)', async () => {
    stub.handlers.runs = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ execution: { status: 'running' }, logs: [{ nodeId: 'transfer', output: { tx_hash: TX1 } }] }));
    };
    const state = createPollState();
    await pollOnce('run-1', baseDeps(stub.port), state);
    await pollOnce('run-1', baseDeps(stub.port), state);
    expect(stub.ingestCalls.length).toBe(1);
  });

  it('on completed status with deprecate tx, posts /rotation/complete and reports done', async () => {
    stub.handlers.runs = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          execution: { status: 'completed' },
          logs: [
            { nodeId: 'transfer', output: { tx_hash: TX1 } },
            { nodeId: 'deprecate', output: { tx_hash: DEPRECATE_TX } },
          ],
        }),
      );
    };
    const state = createPollState();
    const result = await pollOnce('run-42', baseDeps(stub.port), state);
    expect(result.done).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.deprecateTxHash).toBe(DEPRECATE_TX);
    expect(stub.completeCalls.length).toBe(1);
    expect(stub.completeCalls[0]!.body).toEqual({ runId: 'run-42', deprecateTxHash: DEPRECATE_TX });
    expect(stub.completeCalls[0]!.auth).toBe('Bearer wh');
  });

  it('does not retry-mark-seen if Operator /rotation/log-ingest returns 401', async () => {
    let callCount = 0;
    stub.handlers.runs = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ execution: { status: 'running' }, logs: [{ nodeId: 'transfer', output: { tx_hash: TX1 } }] }));
    };
    stub.handlers.ingest = (_req, res) => {
      callCount += 1;
      if (callCount === 1) {
        res.writeHead(401);
        res.end();
      } else {
        res.writeHead(200);
        res.end();
      }
    };
    const state = createPollState();
    await pollOnce('run-1', baseDeps(stub.port), state);
    await pollOnce('run-1', baseDeps(stub.port), state);
    expect(callCount).toBe(2); // retried because the first 401 did NOT mark the node as seen
  });

  it('on KeeperHub 500, applies exponential backoff and reports transient', async () => {
    stub.handlers.runs = (_req, res) => {
      res.writeHead(500);
      res.end();
    };
    const state = createPollState();
    const r1 = await pollOnce('run-1', baseDeps(stub.port), state);
    expect(r1.done).toBe(false);
    expect(r1.transient).toBe(true);
    expect(state.backoff.get('run-1')).toBe(2_000); // 1s base × 2

    const r2 = await pollOnce('run-1', baseDeps(stub.port), state);
    expect(r2.transient).toBe(true);
    expect(state.backoff.get('run-1')).toBe(4_000);
  });

  it('on KeeperHub recovery (500 → 200), backoff resets to baseline', async () => {
    let calls = 0;
    stub.handlers.runs = (_req, res) => {
      calls += 1;
      if (calls === 1) {
        res.writeHead(500);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ execution: { status: 'running' }, logs: [{ nodeId: 'transfer', output: { tx_hash: TX1 } }] }));
    };
    const state = createPollState();
    await pollOnce('run-1', baseDeps(stub.port), state);
    expect(state.backoff.get('run-1')).toBe(2_000);
    await pollOnce('run-1', baseDeps(stub.port), state);
    expect(state.backoff.get('run-1')).toBe(1_000); // reset on success
    expect(stub.ingestCalls.length).toBe(1);
  });
});

describe('mainLoop', () => {
  let stub: StubServer;
  beforeEach(async () => {
    stub = await startStub();
    for (const id of runRegistry.active()) runRegistry.remove(id);
  });
  afterEach(async () => {
    await stop(stub);
  });

  it('with no active runs, sleeps without issuing any /api/runs fetches', async () => {
    let stop = false;
    setTimeout(() => {
      stop = true;
    }, 50);
    await mainLoop(baseDeps(stub.port), createPollState(), {
      pollIntervalMs: 10,
      shouldStop: () => stop,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    expect(stub.runsCalls.length).toBe(0);
  });

  it('removes a runId from runRegistry once status flips to completed', async () => {
    let polls = 0;
    stub.handlers.runs = (_req, res) => {
      polls += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      if (polls < 2) {
        res.end(JSON.stringify({ execution: { status: 'running' }, logs: [] }));
      } else {
        res.end(
          JSON.stringify({
            execution: { status: 'completed' },
            logs: [{ nodeId: 'deprecate', output: { tx_hash: DEPRECATE_TX } }],
          }),
        );
      }
    };
    runRegistry.add('run-loop');
    let stop = false;
    setTimeout(() => {
      stop = true;
    }, 200);
    await mainLoop(baseDeps(stub.port), createPollState(), {
      pollIntervalMs: 10,
      shouldStop: () => stop,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    expect(runRegistry.has('run-loop')).toBe(false);
    expect(stub.completeCalls.length).toBe(1);
  });
});

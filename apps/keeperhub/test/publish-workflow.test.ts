import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { publishWorkflow } from '../src/publish-workflow.js';

interface CapturedReq {
  method?: string;
  url?: string;
  auth?: string;
  contentType?: string;
  body?: string;
}

const DEPLOYED = '0x7eddfc8953a529ce7ffb35de2030f73aad89b31f';

async function writeFixtures(): Promise<{ workflowPath: string; deploymentsPath: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'kh-test-'));
  const deploymentsPath = join(dir, 'base-sepolia.json');
  await writeFile(
    deploymentsPath,
    JSON.stringify({ FleetRegistry: { address: DEPLOYED } }),
  );

  const workflowPath = join(dir, 'workflow.json');
  await writeFile(
    workflowPath,
    JSON.stringify({
      version: 1,
      workflow: { name: 'Sonar rotation', description: '' },
      nodes: [
        {
          id: 'TRG',
          type: 'trigger',
          data: { type: 'trigger', label: 'Manual', config: { triggerType: 'Manual' } },
        },
        {
          id: 'GEN',
          type: 'action',
          data: {
            type: 'action',
            label: 'Webhook',
            config: {
              actionType: 'HTTP Request',
              httpMethod: 'POST',
              endpoint: '{{ env.OPERATOR_BASE_URL }}/rotation/generate',
              httpBody: '{}',
            },
          },
        },
        {
          id: 'WRITE',
          type: 'action',
          data: {
            type: 'action',
            label: 'Write Contract',
            config: {
              actionType: 'web3/write-contract',
              abi: 'Your contract abi',
              abiFunction: 'deprecate',
              functionArgs: '{"wallets": "{{ node1.wallets[*].address }}"}',
              contractAddress: '0x7eddfC8953A529Ce7ffb35de2030f73Aad89b31F',
              network: 'Base Sepolia',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', type: 'animated', source: 'TRG', target: 'GEN' },
        { id: 'e2', type: 'animated', source: 'GEN', target: 'WRITE' },
      ],
      integrationBindings: [],
    }),
  );
  return { workflowPath, deploymentsPath, dir };
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
    res.end(JSON.stringify({ id: 'wf_test_123' }));
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

const baseCfg = (port: number, workflowId?: string) => ({
  apiToken: 'tok-secret',
  apiBaseUrl: `http://127.0.0.1:${port}`,
  workflowId,
  operatorBaseUrl: 'http://localhost:8787',
  webhookSecret: 'wh-secret',
  pollIntervalMs: 3000,
});

describe('publishWorkflow', () => {
  let stub: StubServer;
  let fx: { workflowPath: string; deploymentsPath: string; dir: string };

  beforeEach(async () => {
    stub = await startStub();
    fx = await writeFixtures();
  });

  afterEach(async () => {
    await stop(stub);
  });

  it('POSTs to /api/workflows/create when KEEPERHUB_WORKFLOW_ID is unset', async () => {
    const result = await publishWorkflow({
      cfg: baseCfg(stub.port),
      workflowPath: fx.workflowPath,
      deploymentsPath: fx.deploymentsPath,
    });
    expect(stub.received.method).toBe('POST');
    expect(stub.received.url).toBe('/api/workflows/create');
    expect(result.method).toBe('POST');
    expect(result.workflowId).toBe('wf_test_123');
  });

  it('PATCHes /api/workflows/{id} when KEEPERHUB_WORKFLOW_ID is set', async () => {
    await publishWorkflow({
      cfg: baseCfg(stub.port, 'wf_existing_42'),
      workflowPath: fx.workflowPath,
      deploymentsPath: fx.deploymentsPath,
    });
    expect(stub.received.method).toBe('PATCH');
    expect(stub.received.url).toBe('/api/workflows/wf_existing_42');
  });

  it('sends Authorization: Bearer ${apiToken}', async () => {
    await publishWorkflow({
      cfg: baseCfg(stub.port),
      workflowPath: fx.workflowPath,
      deploymentsPath: fx.deploymentsPath,
    });
    expect(stub.received.auth).toBe('Bearer tok-secret');
    expect(stub.received.contentType).toMatch(/application\/json/);
  });

  it('uploads a body that matches the WorkflowEnvelope schema with the prepared transforms', async () => {
    await publishWorkflow({
      cfg: baseCfg(stub.port),
      workflowPath: fx.workflowPath,
      deploymentsPath: fx.deploymentsPath,
    });
    const body = JSON.parse(stub.received.body!);
    expect(body.name).toBe('Sonar rotation');
    const writeNode = body.nodes.find((n: { id: string }) => n.id === 'WRITE');
    // ABI was injected, contractAddress normalized.
    expect(writeNode.data.config.contractAddress).toBe(DEPLOYED);
    expect(Array.isArray(writeNode.data.config.abi)).toBe(true);
    // Placeholder refs rewritten.
    expect(writeNode.data.config.functionArgs).toContain('GEN.wallets[*].address');
    expect(writeNode.data.config.functionArgs).not.toContain('node1');
  });

  it('throws when KeeperHub returns 401', async () => {
    stub.setResponder((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
    });
    await expect(
      publishWorkflow({
        cfg: baseCfg(stub.port),
        workflowPath: fx.workflowPath,
        deploymentsPath: fx.deploymentsPath,
      }),
    ).rejects.toThrow(/publish_failed status=401/);
  });
});

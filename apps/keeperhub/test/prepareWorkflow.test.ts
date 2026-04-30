import { describe, it, expect } from 'vitest';
import { prepareWorkflow } from '../src/prepareWorkflow.js';
import { DEPRECATE_ABI, DEFAULT_GAS_LIMIT_MULTIPLIER } from '../src/workflowSchema.js';

const DEPLOYED = '0x7eddfc8953a529ce7ffb35de2030f73aad89b31f';
const CHECKSUM = '0x7eddfC8953A529Ce7ffb35de2030f73Aad89b31F';

function fixture(): unknown {
  // Mirrors the real apps/keeperhub/workflow.json shape (post-M-05 dump).
  return {
    version: 1,
    exportedAt: '2026-04-30T17:42:29.989Z',
    workflow: { name: 'Sonar rotation', description: '' },
    nodes: [
      {
        id: 'TRG',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          type: 'trigger',
          label: 'Manual Trigger',
          status: 'idle',
          description: '',
          config: {
            inputSchema: { runId: 'string', runtimeIds: 'string[]' },
            triggerType: 'Manual',
          },
        },
      },
      {
        id: 'GEN_REAL_ID',
        type: 'action',
        position: { x: 272, y: 0 },
        data: {
          type: 'action',
          label: 'Webhook',
          status: 'idle',
          config: {
            actionType: 'HTTP Request',
            httpMethod: 'POST',
            endpoint: '{{ env.OPERATOR_BASE_URL }}/rotation/generate',
            httpHeaders:
              '{"Authorization": "Bearer {{ env.KEEPERHUB_WEBHOOK_SECRET }}"}',
            httpBody: '{"runId": "{{ trigger.runId }}"}',
          },
        },
      },
      {
        id: 'TRANSFER_REAL_ID',
        type: 'action',
        position: { x: 522, y: 0 },
        data: {
          type: 'action',
          label: 'Transfer Native Token',
          status: 'idle',
          config: {
            actionType: 'web3/transfer-funds',
            amount: '0.001',
            forEach: { input: '{{ node1.wallets }}', 'per-iter': {} },
            network: 'Base Sepolia',
            recipientAddress: '{{ item.address }}',
            gasLimitMultiplier: 'Your gas limit',
          },
        },
      },
      {
        id: 'DIST_REAL_ID',
        type: 'action',
        position: { x: 772, y: 0 },
        data: {
          type: 'action',
          label: 'Webhook - Distribute',
          status: 'idle',
          config: {
            actionType: 'HTTP Request',
            httpMethod: 'POST',
            endpoint: '{{ env.OPERATOR_BASE_URL }}/rotation/distribute',
            httpHeaders:
              '{"Authorization": "Bearer {{ env.KEEPERHUB_WEBHOOK_SECRET }}"}',
            httpBody: '{"runId": "{{ trigger.runId }}"}',
          },
        },
      },
      {
        id: 'WRITE_REAL_ID',
        type: 'action',
        position: { x: 1022, y: 0 },
        data: {
          type: 'action',
          label: 'Write Contract',
          status: 'idle',
          config: {
            actionType: 'web3/write-contract',
            abi: 'Your contract abi',
            network: 'Base Sepolia',
            abiFunction: 'deprecate',
            functionArgs: '{"wallets": "{{ node1.wallets[*].address }}"}',
            contractAddress: CHECKSUM,
          },
        },
      },
      {
        id: 'INGEST_REAL_ID',
        type: 'action',
        position: { x: 1272, y: 0 },
        data: {
          type: 'action',
          label: 'Webhook - Log Ingest',
          status: 'idle',
          config: {
            actionType: 'HTTP Request',
            httpMethod: 'POST',
            endpoint: '{{ env.OPERATOR_BASE_URL }}/rotation/log-ingest',
            httpHeaders:
              '{"Authorization": "Bearer {{ env.KEEPERHUB_WEBHOOK_SECRET }}"}',
            httpBody:
              '{"runId": "{{ trigger.runId }}", "events": [{"kind": "fund_tx", "txHashes": "{{ node2.txHashes }}"}, {"kind": "deprecate_tx", "txHash": "{{ node4.txHash }}"}]}',
          },
        },
      },
    ],
    edges: [
      { id: 'e1', type: 'animated', source: 'TRG', target: 'GEN_REAL_ID' },
      { id: 'e2', type: 'animated', source: 'GEN_REAL_ID', target: 'TRANSFER_REAL_ID' },
      { id: 'e3', type: 'animated', source: 'TRANSFER_REAL_ID', target: 'DIST_REAL_ID' },
      { id: 'e4', type: 'animated', source: 'DIST_REAL_ID', target: 'WRITE_REAL_ID' },
      { id: 'e5', type: 'animated', source: 'WRITE_REAL_ID', target: 'INGEST_REAL_ID' },
    ],
    integrationBindings: [],
  };
}

describe('prepareWorkflow', () => {
  it('accepts case-mismatched contractAddress and normalizes to deployments form', () => {
    const { envelope, rewrites } = prepareWorkflow(fixture(), DEPLOYED);
    const writeNode = envelope.nodes.find((n) => n.id === 'WRITE_REAL_ID')!;
    expect((writeNode.data.config as { contractAddress: string }).contractAddress).toBe(DEPLOYED);
    expect(rewrites.some((r) => r.includes('normalized contractAddress'))).toBe(true);
  });

  it('throws when contractAddress does not match deployments', () => {
    const wf = fixture() as ReturnType<typeof fixture> & {
      nodes: Array<{ id: string; data: { config: Record<string, unknown> } }>;
    };
    const writeNode = (wf as any).nodes.find((n: any) => n.id === 'WRITE_REAL_ID');
    writeNode.data.config.contractAddress = '0x' + 'a'.repeat(40);
    expect(() => prepareWorkflow(wf, DEPLOYED)).toThrow(/contractAddress mismatch/);
  });

  it('throws when fleetRegistryAddress is malformed', () => {
    expect(() => prepareWorkflow(fixture(), 'not-an-address')).toThrow(/invalid_deployment_address/);
  });

  it('injects deprecate(address[]) ABI in place of UI placeholder', () => {
    const { envelope } = prepareWorkflow(fixture(), DEPLOYED);
    const writeNode = envelope.nodes.find((n) => n.id === 'WRITE_REAL_ID')!;
    expect((writeNode.data.config as { abi: unknown }).abi).toEqual(DEPRECATE_ABI);
  });

  it('injects default gasLimitMultiplier in place of UI placeholder', () => {
    const { envelope } = prepareWorkflow(fixture(), DEPLOYED);
    const transferNode = envelope.nodes.find((n) => n.id === 'TRANSFER_REAL_ID')!;
    expect((transferNode.data.config as { gasLimitMultiplier: string }).gasLimitMultiplier).toBe(
      DEFAULT_GAS_LIMIT_MULTIPLIER,
    );
  });

  it('rewrites node1/node2/node4 placeholder refs to real upstream node ids', () => {
    const { envelope, rewrites } = prepareWorkflow(fixture(), DEPLOYED);
    const transferNode = envelope.nodes.find((n) => n.id === 'TRANSFER_REAL_ID')!;
    const writeNode = envelope.nodes.find((n) => n.id === 'WRITE_REAL_ID')!;
    const ingestNode = envelope.nodes.find((n) => n.id === 'INGEST_REAL_ID')!;
    const transferForEach = (transferNode.data.config as { forEach: { input: string } }).forEach;
    const writeArgs = (writeNode.data.config as { functionArgs: string }).functionArgs;
    const ingestBody = (ingestNode.data.config as { httpBody: string }).httpBody;

    expect(transferForEach.input).toContain('GEN_REAL_ID.wallets');
    expect(writeArgs).toContain('GEN_REAL_ID.wallets[*].address');
    expect(ingestBody).toContain('TRANSFER_REAL_ID.txHashes');
    expect(ingestBody).toContain('WRITE_REAL_ID.txHash');
    expect(ingestBody).not.toMatch(/\bnode1\b|\bnode2\b|\bnode4\b/);
    expect(rewrites.some((r) => r.includes('node1 → GEN_REAL_ID'))).toBe(true);
  });

  it('preserves the workflow envelope shape (name, edges, integrationBindings)', () => {
    const { envelope } = prepareWorkflow(fixture(), DEPLOYED);
    expect(envelope.workflow.name).toBe('Sonar rotation');
    expect(envelope.edges.length).toBe(5);
    expect(envelope.nodes.length).toBe(6);
  });
});

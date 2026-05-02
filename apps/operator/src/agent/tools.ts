import type { Registry } from '../registry/Registry.js';
import type { HandshakeCoordinator } from '../handshake/HandshakeCoordinator.js';
import type { RingBuffer } from '../log/RingBuffer.js';
import { triggerKeeperhubRun, registerRunWithPoller } from './keeperhub.js';

/**
 * Anthropic-API tool definitions mirroring apps/mcp/src/tools/*. The dispatcher
 * runs everything in-process where possible; only run_rotation hits HTTP
 * (KeeperHub + the local poller's /poller/register).
 */

export interface AgentToolsCtx {
  registry: Registry;
  coordinator: HandshakeCoordinator;
  buffer: RingBuffer;
  keeperhub: {
    apiBaseUrl: string;
    apiToken: string;
    workflowId: string;
    pollerBaseUrl: string;
    webhookSecret: string;
  };
}

export const TOOL_DEFS = [
  {
    name: 'list_runtimes',
    description:
      'Lists all runtimes the Operator knows about with their current status (registered, awaiting, received, deprecated, revoked).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'revoke',
    description:
      'DESTRUCTIVE. Permanently revokes a runtime by id; further handshakes from that runtime will fail.',
    input_schema: {
      type: 'object' as const,
      properties: {
        runtimeId: { type: 'string', minLength: 1 },
        reason: { type: 'string' },
      },
      required: ['runtimeId'],
      additionalProperties: false,
    },
  },
  {
    name: 'run_rotation',
    description:
      'DESTRUCTIVE. Triggers a KeeperHub workflow run that generates fresh EOAs, funds them, distributes to runtimes, and deprecates old wallets on Base Sepolia. Returns runId immediately.',
    input_schema: {
      type: 'object' as const,
      properties: {
        runtimeIds: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
          description: 'Runtime IDs to rotate (1:1 mapping with generated wallets).',
        },
      },
      required: ['runtimeIds'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_workflow_log',
    description:
      'Returns the most recent log/status events captured from the Operator. Buffer is in-memory and lost on operator restart.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 500 },
        runtimeId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
] as const;

export type ToolName = typeof TOOL_DEFS[number]['name'];

export async function dispatchTool(
  ctx: AgentToolsCtx,
  name: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; output: unknown } | { ok: false; code: string; message: string }> {
  switch (name) {
    case 'list_runtimes': {
      const runtimes = ctx.registry.list().map((r) => ({
        runtimeId: r.runtimeId,
        status: r.status,
        registeredAt: r.registeredAt,
        lastHandshakeAt: r.lastHandshakeAt,
      }));
      return { ok: true, output: { runtimes } };
    }

    case 'revoke': {
      const runtimeId = String(input['runtimeId'] ?? '');
      const reason = String(input['reason'] ?? 'agent_initiated');
      if (!runtimeId) return { ok: false, code: 'invalid_input', message: 'runtimeId required' };
      if (!ctx.registry.get(runtimeId)) {
        return { ok: false, code: 'runtime_not_found', message: `unknown runtime: ${runtimeId}` };
      }
      ctx.coordinator.forceRevoke(runtimeId, reason);
      return { ok: true, output: { status: 'revoked', runtimeId } };
    }

    case 'run_rotation': {
      const runtimeIds = Array.isArray(input['runtimeIds']) ? (input['runtimeIds'] as string[]) : [];
      if (runtimeIds.length === 0) {
        return { ok: false, code: 'invalid_input', message: 'runtimeIds must be non-empty' };
      }
      const { apiBaseUrl, apiToken, workflowId, pollerBaseUrl, webhookSecret } = ctx.keeperhub;
      if (!apiToken || !workflowId) {
        return {
          ok: false,
          code: 'keeperhub_not_configured',
          message: 'KEEPERHUB_API_TOKEN and KEEPERHUB_WORKFLOW_ID must be set',
        };
      }
      let runId: string;
      try {
        const out = await triggerKeeperhubRun({ apiBaseUrl, apiToken, workflowId }, { runtimeIds });
        runId = out.runId;
      } catch (e) {
        const code = e instanceof Error ? e.message.replace(/^http_/, '') : 'unknown';
        return { ok: false, code: 'keeperhub_unavailable', message: `KeeperHub failed: ${code}` };
      }
      const reg = await registerRunWithPoller({ pollerBaseUrl, webhookSecret }, runId);
      return {
        ok: true,
        output: {
          runId,
          runtimeIds,
          walletCount: runtimeIds.length,
          pollerRegistered: reg.ok,
        },
      };
    }

    case 'get_workflow_log': {
      const limit = typeof input['limit'] === 'number' ? input['limit'] : 50;
      const runtimeId = typeof input['runtimeId'] === 'string' ? input['runtimeId'] : undefined;
      const events = ctx.buffer.snapshot({ runtimeId }, limit);
      return { ok: true, output: { events, count: events.length } };
    }

    default:
      return { ok: false, code: 'unknown_tool', message: `tool ${name} is not defined` };
  }
}

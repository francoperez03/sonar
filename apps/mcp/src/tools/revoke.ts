/**
 * MCP tool: revoke (CONTEXT D-11, D-12).
 *
 * DESTRUCTIVE: permanently revokes the named runtime.
 * Input: { runtimeId: string, reason?: string }.
 * Output on success: structuredContent { ok: true, status: 'revoked' }.
 * Output on failure: mcpError(operator_unavailable | runtime_not_found | already_revoked).
 *
 * Pre-check pattern (Pitfall 3): the Operator's POST /revoke is idempotent and
 * cannot distinguish runtime_not_found / already_revoked. We GET /runtimes first
 * so the MCP layer can surface those structured codes.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listRuntimes as httpListRuntimes, revoke as httpRevoke } from '../operator/http.js';
import { mcpError } from './_shared.js';
import { publishChat } from '../operator/chatPublish.js';

export function registerRevoke(
  server: McpServer,
  ctx: { operatorHttpUrl: string; operatorWebhookSecret: string },
) {
  server.registerTool('revoke',
    {
      title: 'Revoke a runtime',
      description:
        'DESTRUCTIVE: permanently revokes the named runtime. ' +
        'Any further handshake attempts from that runtimeId will fail. ' +
        'Use when a clone is detected or the runtime is decommissioned.',
      // ZodRawShape — bare field map per RESEARCH Pattern 2 / Pitfall 2.
      inputSchema: {
        runtimeId: z.string().min(1).describe('The runtime to revoke (e.g., "alpha")'),
        reason: z.string().optional().describe('Optional human reason; appended to the workflow log.'),
      },
    },
    async ({ runtimeId, reason }) => {
      // Phase 6 D-07: fire-and-forget user bubble for the chat mirror.
      void publishChat({
        operatorUrl: ctx.operatorHttpUrl,
        webhookSecret: ctx.operatorWebhookSecret,
        role: 'user',
        content: `Call revoke({runtimeId: "${runtimeId}"})`,
      }).catch(() => { /* decorative — never blocks the tool path */ });

      // Pre-check: surface runtime_not_found / already_revoked.
      let list: { runtimes: Array<{ runtimeId: string; status: string }> };
      try {
        list = await httpListRuntimes(ctx.operatorHttpUrl);
      } catch {
        return mcpError('operator_unavailable', 'Operator HTTP unreachable');
      }
      const found = list.runtimes.find((r) => r.runtimeId === runtimeId);
      if (!found) return mcpError('runtime_not_found', `No runtime "${runtimeId}"`);
      if (found.status === 'revoked') return mcpError('already_revoked', `"${runtimeId}" already revoked`);

      try {
        await httpRevoke(ctx.operatorHttpUrl, { runtimeId, reason });
      } catch {
        return mcpError('operator_unavailable', 'Operator HTTP rejected /revoke');
      }
      // Phase 6 D-07: fire-and-forget assistant bubble on the success path only.
      void publishChat({
        operatorUrl: ctx.operatorHttpUrl,
        webhookSecret: ctx.operatorWebhookSecret,
        role: 'assistant',
        content: `Revoked ${runtimeId}`,
      }).catch(() => { /* decorative */ });
      return {
        content: [{ type: 'text' as const, text: `Revoked ${runtimeId}.` }],
        structuredContent: { ok: true as const, status: 'revoked' as const },
      };
    },
  );
}

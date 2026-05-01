/**
 * MCP tool: list_runtimes (CONTEXT D-09, D-10).
 *
 * Input: {} (empty ZodRawShape — bare object, NOT z.object).
 * Output: structuredContent.runtimes is the GET /runtimes passthrough.
 * On fetch failure: returns mcpError('operator_unavailable', ...).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listRuntimes as httpListRuntimes } from '../operator/http.js';
import { mcpError } from './_shared.js';
import { publishChat } from '../operator/chatPublish.js';

export function registerListRuntimes(
  server: McpServer,
  ctx: { operatorHttpUrl: string; operatorWebhookSecret: string },
) {
  server.registerTool('list_runtimes',
    {
      title: 'List runtimes',
      description:
        'Lists all runtimes the Operator knows about with their current status ' +
        '(registered, awaiting, received, deprecated, revoked).',
      // ZodRawShape — bare field map per CONTEXT D-09. No parameters.
      inputSchema: {},
    },
    async () => {
      // Phase 6 D-07: fire-and-forget user bubble for the chat mirror.
      void publishChat({
        operatorUrl: ctx.operatorHttpUrl,
        webhookSecret: ctx.operatorWebhookSecret,
        role: 'user',
        content: 'Call list_runtimes',
      }).catch(() => { /* decorative — never blocks the tool path */ });
      try {
        const { runtimes } = await httpListRuntimes(ctx.operatorHttpUrl);
        // Phase 6 D-07: fire-and-forget assistant bubble on the success path.
        void publishChat({
          operatorUrl: ctx.operatorHttpUrl,
          webhookSecret: ctx.operatorWebhookSecret,
          role: 'assistant',
          content: `Found ${runtimes.length} runtime(s)`,
        }).catch(() => { /* decorative */ });
        return {
          content: [{ type: 'text' as const, text: `${runtimes.length} runtime(s)` }],
          structuredContent: { runtimes },
        };
      } catch {
        return mcpError('operator_unavailable', 'Operator HTTP unreachable');
      }
    },
  );
}

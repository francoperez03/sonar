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

export function registerListRuntimes(server: McpServer, ctx: { operatorHttpUrl: string }) {
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
      try {
        const { runtimes } = await httpListRuntimes(ctx.operatorHttpUrl);
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

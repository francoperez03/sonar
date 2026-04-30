/**
 * MCP tool: get_workflow_log (CONTEXT D-14, D-15).
 *
 * Input: { limit?: 1..500, runtimeId? }. limit defaults to 50.
 * Output: structuredContent.events is RingBuffer.snapshot({ runtimeId }, limit).
 *
 * Filter-then-limit semantics live inside RingBuffer.snapshot (Plan 02).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RingBuffer } from '../buffer/RingBuffer.js';

export function registerGetWorkflowLog(server: McpServer, ctx: { buffer: RingBuffer }) {
  server.registerTool('get_workflow_log',
    {
      title: 'Get workflow log',
      description:
        'Returns the most recent log/status events captured from the Operator. ' +
        'Buffer is in-memory only and lost on MCP-server restart.',
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional().describe('Max events to return (1-500, default 50).'),
        runtimeId: z.string().optional().describe('Filter to events from a single runtime.'),
      },
    },
    async ({ limit, runtimeId }) => {
      const events = ctx.buffer.snapshot({ runtimeId }, limit ?? 50);
      return {
        content: [{ type: 'text' as const, text: `${events.length} event(s)` }],
        structuredContent: { events },
      };
    },
  );
}

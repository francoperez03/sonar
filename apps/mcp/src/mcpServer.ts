/**
 * MCP server DI factory. Registers the three Phase 4 tools but does NOT
 * connect a transport — index.ts owns stdio wiring. Tests construct a server
 * via this factory and invoke registered tool callbacks directly.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListRuntimes } from './tools/listRuntimes.js';
import { registerRevoke } from './tools/revoke.js';
import { registerGetWorkflowLog } from './tools/getWorkflowLog.js';
import type { RingBuffer } from './buffer/RingBuffer.js';

export interface McpDeps {
  buffer: RingBuffer;
  operatorHttpUrl: string;
}

export function buildMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'sonar', version: '0.1.0' });
  registerListRuntimes(server, { operatorHttpUrl: deps.operatorHttpUrl });
  registerRevoke(server, { operatorHttpUrl: deps.operatorHttpUrl });
  registerGetWorkflowLog(server, { buffer: deps.buffer });
  return server;
}

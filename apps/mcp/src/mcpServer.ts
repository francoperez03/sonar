/**
 * MCP server DI factory. Registers the three Phase 4 tools but does NOT
 * connect a transport — index.ts owns stdio wiring. Tests construct a server
 * via this factory and invoke registered tool callbacks directly.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListRuntimes } from './tools/listRuntimes.js';
import { registerRevoke } from './tools/revoke.js';
import { registerGetWorkflowLog } from './tools/getWorkflowLog.js';
import { registerRunRotation } from './tools/runRotation.js';
import type { RingBuffer } from './buffer/RingBuffer.js';

export interface McpDeps {
  buffer: RingBuffer;
  operatorHttpUrl: string;
  // Phase 5 — run_rotation tool deps. Optional so Phase 4 tests + downstream
  // callers that only need the original three tools continue to typecheck.
  // The tool itself returns mcpError('keeperhub_not_configured', ...) if
  // apiToken/workflowId end up empty at invocation time.
  keeperhubBaseUrl?: string;
  keeperhubApiToken?: string;
  keeperhubWorkflowId?: string;
  pollerBaseUrl?: string;
  keeperhubWebhookSecret?: string;
}

export function buildMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'sonar', version: '0.1.0' });
  registerListRuntimes(server, { operatorHttpUrl: deps.operatorHttpUrl });
  registerRevoke(server, { operatorHttpUrl: deps.operatorHttpUrl });
  registerGetWorkflowLog(server, { buffer: deps.buffer });
  registerRunRotation(server, {
    apiBaseUrl: deps.keeperhubBaseUrl ?? 'https://app.keeperhub.com',
    apiToken: deps.keeperhubApiToken ?? '',
    workflowId: deps.keeperhubWorkflowId ?? '',
    pollerBaseUrl: deps.pollerBaseUrl ?? 'http://localhost:8788',
    webhookSecret: deps.keeperhubWebhookSecret ?? '',
  });
  return server;
}

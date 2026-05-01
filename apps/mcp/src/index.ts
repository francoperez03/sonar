/**
 * MCP stdio entrypoint.
 *
 * Boots the MCP server (RESEARCH Pattern 1):
 *   1. getConfig — env vars with localhost defaults (CONTEXT D-16).
 *   2. RingBuffer(cfg.logBufferSize) — in-memory backing store for get_workflow_log.
 *   3. connectLogs(...) — fire-and-forget WS subscription with internal retries (D-03).
 *   4. buildMcpServer(...) — registers list_runtimes / revoke / get_workflow_log.
 *   5. server.connect(StdioServerTransport) — process now blocks on stdio.
 *
 * IMPORTANT (Pitfall 1): stdout is the JSON-RPC wire. All diagnostics go to
 * stderr via util/log.ts. Never write to stdout from anywhere in this process.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfig } from './config.js';
import { RingBuffer } from './buffer/RingBuffer.js';
import { connectLogs } from './operator/logs.js';
import { buildMcpServer } from './mcpServer.js';
import { log } from './util/log.js';

const cfg = getConfig();
const buffer = new RingBuffer(cfg.logBufferSize);

// Fire-and-forget — connectLogs retries forever internally (CONTEXT D-03).
connectLogs({ url: cfg.operatorLogsWs, buffer });

const server = buildMcpServer({
  buffer,
  operatorHttpUrl: cfg.operatorHttpUrl,
  keeperhubBaseUrl: cfg.keeperhubBaseUrl,
  keeperhubApiToken: cfg.keeperhubApiToken,
  keeperhubWorkflowId: cfg.keeperhubWorkflowId,
  pollerBaseUrl: cfg.pollerBaseUrl,
  keeperhubWebhookSecret: cfg.keeperhubWebhookSecret,
  operatorWebhookSecret: cfg.operatorWebhookSecret,
});
const transport = new StdioServerTransport();

log({
  msg: 'mcp_starting',
  operatorHttpUrl: cfg.operatorHttpUrl,
  operatorLogsWs: cfg.operatorLogsWs,
});

await server.connect(transport);
// Process now blocks on stdio; SIGINT/SIGTERM ends it.

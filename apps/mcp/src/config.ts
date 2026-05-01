/**
 * MCP environment configuration. Per CONTEXT D-16.
 * Mirrors the operator/runtime config pattern: a single getConfig() that reads
 * process.env with localhost defaults.
 */
export interface McpConfig {
  operatorHttpUrl: string;   // OPERATOR_HTTP_URL, default http://localhost:8787
  operatorLogsWs: string;    // OPERATOR_LOGS_WS,  default ws://localhost:8787/logs
  logBufferSize: number;     // LOG_BUFFER_SIZE,   default 500
  /**
   * Bearer secret for the Operator's bearer-auth'd routes
   * (currently /rotation/* and /log/publish — Phase 5 D-18, Phase 6 D-07).
   * Mirrors the operator-side env name (KEEPERHUB_WEBHOOK_SECRET) so a single
   * value drives both processes. Empty string disables chat publishing
   * (decorative — never throws out of the MCP critical path).
   */
  operatorWebhookSecret: string;  // KEEPERHUB_WEBHOOK_SECRET
}

export function getConfig(): McpConfig {
  return {
    operatorHttpUrl: process.env['OPERATOR_HTTP_URL'] ?? 'http://localhost:8787',
    operatorLogsWs:  process.env['OPERATOR_LOGS_WS']  ?? 'ws://localhost:8787/logs',
    logBufferSize:   Number(process.env['LOG_BUFFER_SIZE'] ?? 500),
    operatorWebhookSecret: process.env['KEEPERHUB_WEBHOOK_SECRET'] ?? '',
  };
}

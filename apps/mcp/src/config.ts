/**
 * MCP environment configuration. Per CONTEXT D-16.
 * Mirrors the operator/runtime config pattern: a single getConfig() that reads
 * process.env with localhost defaults.
 */
export interface McpConfig {
  operatorHttpUrl: string;   // OPERATOR_HTTP_URL, default http://localhost:8787
  operatorLogsWs: string;    // OPERATOR_LOGS_WS,  default ws://localhost:8787/logs
  logBufferSize: number;     // LOG_BUFFER_SIZE,   default 500
}

export function getConfig(): McpConfig {
  return {
    operatorHttpUrl: process.env['OPERATOR_HTTP_URL'] ?? 'http://localhost:8787',
    operatorLogsWs:  process.env['OPERATOR_LOGS_WS']  ?? 'ws://localhost:8787/logs',
    logBufferSize:   Number(process.env['LOG_BUFFER_SIZE'] ?? 500),
  };
}

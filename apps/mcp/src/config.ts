/**
 * MCP environment configuration. Per CONTEXT D-16.
 * Mirrors the operator/runtime config pattern: a single getConfig() that reads
 * process.env with localhost defaults.
 *
 * Phase 5 additions (run_rotation tool):
 *   - keeperhubApiToken:      KEEPERHUB_API_TOKEN     (empty default; tool-level check)
 *   - keeperhubBaseUrl:       KEEPERHUB_BASE_URL      (default https://app.keeperhub.com)
 *   - keeperhubWorkflowId:    KEEPERHUB_WORKFLOW_ID   (empty default; tool-level check)
 *   - pollerBaseUrl:          POLLER_BASE_URL         (default http://localhost:8788)
 *   - keeperhubWebhookSecret: KEEPERHUB_WEBHOOK_SECRET — REQUIRED, throws at boot if unset (D-18 / B-02)
 */
export interface McpConfig {
  operatorHttpUrl: string;        // OPERATOR_HTTP_URL,        default http://localhost:8787
  operatorLogsWs: string;         // OPERATOR_LOGS_WS,         default ws://localhost:8787/logs
  logBufferSize: number;          // LOG_BUFFER_SIZE,          default 500
  // Phase 5 additions:
  keeperhubApiToken: string;
  keeperhubBaseUrl: string;
  keeperhubWorkflowId: string;
  pollerBaseUrl: string;
  keeperhubWebhookSecret: string; // strict — throws if unset
}

export function getConfig(): McpConfig {
  const webhookSecret = process.env['KEEPERHUB_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    throw new Error('KEEPERHUB_WEBHOOK_SECRET is required');
  }
  return {
    operatorHttpUrl: process.env['OPERATOR_HTTP_URL'] ?? 'http://localhost:8787',
    operatorLogsWs:  process.env['OPERATOR_LOGS_WS']  ?? 'ws://localhost:8787/logs',
    logBufferSize:   Number(process.env['LOG_BUFFER_SIZE'] ?? 500),
    keeperhubApiToken:      process.env['KEEPERHUB_API_TOKEN']    ?? '',
    keeperhubBaseUrl:       process.env['KEEPERHUB_BASE_URL']     ?? 'https://app.keeperhub.com',
    keeperhubWorkflowId:    process.env['KEEPERHUB_WORKFLOW_ID']  ?? '',
    pollerBaseUrl:          process.env['POLLER_BASE_URL']        ?? 'http://localhost:8788',
    keeperhubWebhookSecret: webhookSecret,
  };
}

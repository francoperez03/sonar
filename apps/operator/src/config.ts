/**
 * Operator environment configuration. Per Phase 3 CONTEXT D-20 + Phase 5 D-18.
 */
export interface OperatorConfig {
  httpPort: number;
  registryPath: string;
  keeperhubWebhookSecret: string;
  // Phase 7 — agent endpoint:
  anthropicApiKey: string;
  keeperhubApiToken: string;
  keeperhubBaseUrl: string;
  keeperhubWorkflowId: string;
  pollerBaseUrl: string;
  logBufferSize: number;
}

export function getConfig(): OperatorConfig {
  const keeperhubWebhookSecret = process.env['KEEPERHUB_WEBHOOK_SECRET'];
  if (!keeperhubWebhookSecret) {
    throw new Error('KEEPERHUB_WEBHOOK_SECRET is required');
  }
  return {
    httpPort: Number(process.env['OPERATOR_HTTP_PORT'] ?? 8787),
    registryPath: process.env['REGISTRY_PATH'] ?? 'apps/operator/data/registry.json',
    keeperhubWebhookSecret,
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
    keeperhubApiToken: process.env['KEEPERHUB_API_TOKEN'] ?? '',
    keeperhubBaseUrl: process.env['KEEPERHUB_BASE_URL'] ?? 'https://app.keeperhub.com',
    keeperhubWorkflowId: process.env['KEEPERHUB_WORKFLOW_ID'] ?? '',
    pollerBaseUrl: process.env['POLLER_BASE_URL'] ?? 'http://localhost:8788',
    logBufferSize: Number(process.env['LOG_BUFFER_SIZE'] ?? 500),
  };
}

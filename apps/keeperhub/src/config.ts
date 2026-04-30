/**
 * @sonar/keeperhub environment configuration.
 *
 * Required at boot:
 *   - KEEPERHUB_API_TOKEN    (M-01)
 *   - KEEPERHUB_WEBHOOK_SECRET  (Plan 03 D-18 / B-02 — strict-required, no fallback)
 *
 * Optional with defaults:
 *   - KEEPERHUB_BASE_URL     default https://app.keeperhub.com
 *   - KEEPERHUB_WORKFLOW_ID  set by `publish:workflow` (M-06)
 *   - OPERATOR_BASE_URL      default http://localhost:8787
 *   - POLL_INTERVAL_MS       default 3000
 */
export interface KeeperhubConfig {
  apiToken: string;
  apiBaseUrl: string;
  workflowId?: string;
  operatorBaseUrl: string;
  webhookSecret: string;
  pollIntervalMs: number;
}

export function getConfig(): KeeperhubConfig {
  const apiToken = process.env['KEEPERHUB_API_TOKEN'];
  if (!apiToken) throw new Error('KEEPERHUB_API_TOKEN required');

  const webhookSecret = process.env['KEEPERHUB_WEBHOOK_SECRET'];
  if (!webhookSecret) throw new Error('KEEPERHUB_WEBHOOK_SECRET is required');

  return {
    apiToken,
    apiBaseUrl: process.env['KEEPERHUB_BASE_URL'] ?? 'https://app.keeperhub.com',
    workflowId: process.env['KEEPERHUB_WORKFLOW_ID'] ?? undefined,
    operatorBaseUrl: process.env['OPERATOR_BASE_URL'] ?? 'http://localhost:8787',
    webhookSecret,
    pollIntervalMs: Number(process.env['POLL_INTERVAL_MS'] ?? 3000),
  };
}

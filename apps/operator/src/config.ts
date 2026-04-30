/**
 * Operator environment configuration. Per Phase 3 CONTEXT D-20 + Phase 5 D-18.
 */
export interface OperatorConfig {
  httpPort: number;                // OPERATOR_HTTP_PORT, default 8787
  registryPath: string;            // REGISTRY_PATH, default apps/operator/data/registry.json
  keeperhubWebhookSecret: string;  // KEEPERHUB_WEBHOOK_SECRET — REQUIRED (Phase 5 D-18, no fallback)
}

export function getConfig(): OperatorConfig {
  const keeperhubWebhookSecret = process.env['KEEPERHUB_WEBHOOK_SECRET'];
  if (!keeperhubWebhookSecret) {
    // Phase 5 D-18 / B-02: fail loudly at boot — no silent fallback that would
    // ship an unauthed /rotation/* surface in production.
    throw new Error('KEEPERHUB_WEBHOOK_SECRET is required');
  }
  return {
    httpPort: Number(process.env['OPERATOR_HTTP_PORT'] ?? 8787),
    registryPath: process.env['REGISTRY_PATH'] ?? 'apps/operator/data/registry.json',
    keeperhubWebhookSecret,
  };
}

/**
 * Operator environment configuration. Per CONTEXT D-20.
 */
export interface OperatorConfig {
  httpPort: number;      // OPERATOR_HTTP_PORT, default 8787
  registryPath: string;  // REGISTRY_PATH, default apps/operator/data/registry.json
}

export function getConfig(): OperatorConfig {
  return {
    httpPort: Number(process.env['OPERATOR_HTTP_PORT'] ?? 8787),
    registryPath: process.env['REGISTRY_PATH'] ?? 'apps/operator/data/registry.json',
  };
}

export interface RuntimeConfig {
  runtimeId: string;   // RUNTIME_ID — required, throws if missing
  operatorUrl: string; // OPERATOR_URL — default ws://localhost:8787/runtime
}

export function getConfig(): RuntimeConfig {
  const runtimeId = process.env.RUNTIME_ID;
  if (!runtimeId) throw new Error('RUNTIME_ID required');
  const operatorUrl = process.env.OPERATOR_URL ?? 'ws://localhost:8787/runtime';
  return { runtimeId, operatorUrl };
}

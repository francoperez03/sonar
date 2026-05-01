/**
 * Cross-process run registration. Per CONTEXT D-20.
 *
 * apps/mcp runs as Claude Desktop's stdio child. apps/keeperhub poll-execution runs as a
 * separate long-lived Node process. They share NO module state, so a direct
 * `import { runRegistry }` would create two unrelated Set instances. We bridge them via
 * a tiny localhost HTTP endpoint exposed by apps/keeperhub's poller-server.
 *
 * Failure-tolerant: never throws; returns { ok: false } so run_rotation can still
 * surface the runId to Claude even if the poller is temporarily down.
 */
export interface PollerRegistryCtx {
  pollerBaseUrl: string;
  webhookSecret: string;
}

export async function registerRunWithPoller(
  ctx: PollerRegistryCtx,
  runId: string,
): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(`${ctx.pollerBaseUrl}/poller/register`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${ctx.webhookSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ runId }),
      // W-05: bound poller-down failure mode at 1s so the MCP tool returns promptly.
      signal: AbortSignal.timeout(1000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

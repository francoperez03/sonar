/**
 * KeeperHub HTTP client — mirror of apps/mcp/src/keeperhub/http.ts.
 * Kept local to apps/operator to avoid an awkward cross-app import.
 */
export interface KeeperhubCtx {
  apiBaseUrl: string;
  apiToken: string;
  workflowId: string;
}

export async function triggerKeeperhubRun(
  ctx: KeeperhubCtx,
  input: { runtimeIds: string[] },
): Promise<{ runId: string }> {
  let res: Response;
  try {
    res = await fetch(`${ctx.apiBaseUrl}/api/workflow/${ctx.workflowId}/execute`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${ctx.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });
  } catch {
    throw new Error('http_network');
  }
  if (!res.ok) throw new Error(`http_${res.status}`);
  const out = (await res.json().catch(() => ({}))) as {
    runId?: string;
    id?: string;
    executionId?: string;
  };
  const runId = out.executionId ?? out.runId ?? out.id;
  if (!runId) throw new Error('http_invalid_response');
  return { runId };
}

export async function registerRunWithPoller(
  ctx: { pollerBaseUrl: string; webhookSecret: string },
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
      signal: AbortSignal.timeout(1000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

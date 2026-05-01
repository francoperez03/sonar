/**
 * KeeperHub run-trigger client. Per CONTEXT D-08.
 *
 * Mirrors the fetch + Bearer + structured-throw idiom of apps/mcp/src/operator/http.ts.
 *
 * IMPORTANT — endpoint shape (verified against the KeeperHub MCP client source
 * github.com/KeeperHub/mcp/src/client/keeperhub.ts; same correction applied during
 * Plan 04 M-06 to the publish path):
 *
 *   POST {apiBaseUrl}/api/workflow/{workflowId}/execute   (SINGULAR `workflow`)
 *     Header: Authorization: Bearer {apiToken}
 *     Body:   { input: { runtimeIds: string[] } }
 *     Response 2xx JSON: { executionId?: string, id?: string, runId?: string }
 *
 * The plan's pseudo-code referenced `/api/workflows/{id}/runs` and a `runId` field —
 * both are wrong for the real API and were corrected before landing.
 */
export interface KeeperhubCtx {
  apiBaseUrl: string;
  apiToken: string;
  workflowId: string;
}

export interface RunInput {
  runtimeIds: string[];
  // walletCount REMOVED per D-09 (1:1 mapping; wallet count is strictly runtimeIds.length).
}

export async function triggerKeeperhubRun(
  ctx: KeeperhubCtx,
  input: RunInput,
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

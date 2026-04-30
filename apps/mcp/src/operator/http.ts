/**
 * Typed HTTP wrappers for the operator HTTP plane.
 * Native Node fetch (CONTEXT D-04). Errors are surfaced as Error('http_<status>')
 * so MCP tools can translate to operator-domain error codes.
 */

export interface RuntimeListItem {
  runtimeId: string;
  status: 'registered' | 'awaiting' | 'received' | 'deprecated' | 'revoked';
  registeredAt: number;
  /** Operator route does NOT currently expose this (Phase 3 D-13 allow-list); kept optional for forward compat (CONTEXT D-10). */
  lastHandshakeAt?: number;
}

export async function listRuntimes(baseUrl: string): Promise<{ runtimes: RuntimeListItem[] }> {
  const res = await fetch(`${baseUrl}/runtimes`);
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json() as Promise<{ runtimes: RuntimeListItem[] }>;
}

export async function revoke(
  baseUrl: string,
  body: { runtimeId: string; reason?: string },
): Promise<{ status: 'revoked' }> {
  const res = await fetch(`${baseUrl}/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json() as Promise<{ status: 'revoked' }>;
}

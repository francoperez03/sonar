/**
 * Structured JSON line writer. Writes to STDERR — stdout is reserved for
 * MCP JSON-RPC framing. Any console.log in the MCP process corrupts the wire.
 */
export function log(obj: Record<string, unknown>): void {
  console.error(JSON.stringify(obj));
}

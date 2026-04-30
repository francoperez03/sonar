/**
 * Structured JSON line writer. Per Phase 5 PATTERNS S-6 (verbatim from operator).
 * This is a regular Node process — stdout is NOT a JSON-RPC wire (the MCP `console.error`
 * variant does NOT apply here).
 */
export function log(obj: Record<string, unknown>): void {
  console.log(JSON.stringify(obj));
}

/**
 * Shared helper for MCP tool error returns.
 *
 * Returns the locked structured-error envelope (CONTEXT D-12 style):
 *   { isError: true, content: [text], structuredContent: { ok: false, code, message } }
 *
 * Tools surface domain error codes (operator_unavailable | runtime_not_found | already_revoked)
 * through this helper so Claude Desktop sees both human-readable text AND a parseable code.
 *
 * Phase 6 D-07 cross-cut: action-tier tools (list_runtimes, revoke, and the
 * future Phase 5 run_rotation) emit a user+assistant ChatMsg pair via
 * src/operator/chatPublish.ts. get_workflow_log is intentionally NOT
 * instrumented — it is a passive query (RESEARCH Open Q3) and would flood
 * the demo chat mirror with refresh churn.
 */
export function mcpError(code: string, message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `[${code}] ${message}` }],
    structuredContent: { ok: false as const, code, message },
  };
}

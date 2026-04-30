/**
 * Shared helper for MCP tool error returns.
 *
 * Returns the locked structured-error envelope (CONTEXT D-12 style):
 *   { isError: true, content: [text], structuredContent: { ok: false, code, message } }
 *
 * Tools surface domain error codes (operator_unavailable | runtime_not_found | already_revoked)
 * through this helper so Claude Desktop sees both human-readable text AND a parseable code.
 */
export function mcpError(code: string, message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `[${code}] ${message}` }],
    structuredContent: { ok: false as const, code, message },
  };
}

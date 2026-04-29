/**
 * Structured JSON line writer. Per PATTERNS S-6.
 */
export function log(obj: Record<string, unknown>): void {
  console.log(JSON.stringify(obj));
}

/**
 * In-process registry of active KeeperHub runIds. Per CONTEXT D-20.
 *
 * Plan 05 (run_rotation MCP tool) calls runRegistry.add(runId) immediately after
 * KeeperHub returns the run-trigger response. poll-execution.ts polls each active runId
 * and calls runRegistry.remove(runId) once status === 'completed' | 'failed'.
 *
 * Module-level Set — no persistence across process restarts. If the poller crashes mid-run
 * the in-flight runId is dropped; this is acceptable for the demo because (a) runs are short,
 * (b) KeeperHub keeps full execution logs in the dashboard, and (c) Phase 6 Demo UI also
 * has the dashboard as a fallback (CONTEXT D-16).
 */
const active = new Set<string>();

export const runRegistry = {
  add(runId: string): void { active.add(runId); },
  remove(runId: string): void { active.delete(runId); },
  active(): string[] { return [...active]; },
  has(runId: string): boolean { return active.has(runId); },
};

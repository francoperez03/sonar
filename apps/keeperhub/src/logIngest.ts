/**
 * Small fetch-with-bearer helpers used by poll-execution.ts to forward run state
 * into the Operator's `/rotation/log-ingest` and `/rotation/complete` endpoints.
 *
 * Validates the LogEntryMsg body against `@sonar/shared`'s Zod schema before POSTing
 * (Phase 2 D-09 trust-boundary rule applies on outbound serialization too — we do not
 * want to ship a malformed entry to the Operator's LogBus).
 */
import { LogEntryMsg } from '@sonar/shared';
import type { z } from 'zod';

export type LogEntry = z.infer<typeof LogEntryMsg>;

export async function postLogEntry(
  operatorBaseUrl: string,
  webhookSecret: string,
  entry: LogEntry,
): Promise<{ ok: boolean; status: number }> {
  const validated = LogEntryMsg.parse(entry);
  const res = await fetch(`${operatorBaseUrl}/rotation/log-ingest`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${webhookSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(validated),
  });
  return { ok: res.ok, status: res.status };
}

export async function postRotationComplete(
  operatorBaseUrl: string,
  webhookSecret: string,
  body: { runId: string; deprecateTxHash: string },
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${operatorBaseUrl}/rotation/complete`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${webhookSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

import { z } from 'zod';

export const LogEntryMsg = z.object({
  type: z.literal('log_entry'),
  runtimeId: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  timestamp: z.number(), // unix ms
});
export type LogEntryMsg = z.infer<typeof LogEntryMsg>;

export const StatusChangeMsg = z.object({
  type: z.literal('status_change'),
  runtimeId: z.string(),
  status: z.enum(['registered', 'awaiting', 'received', 'deprecated', 'revoked']),
  timestamp: z.number(), // unix ms
});
export type StatusChangeMsg = z.infer<typeof StatusChangeMsg>;

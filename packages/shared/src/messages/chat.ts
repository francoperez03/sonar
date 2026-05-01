import { z } from 'zod';

/**
 * Phase 6 D-07/D-09: chat-typed log event for the demo-ui ChatMirror.
 *
 * Producer: apps/mcp publishes one user + one assistant ChatMsg per tool
 * invocation via POST /log/publish.
 * Consumer: apps/demo-ui subscribes to the same /logs WS broadcast and
 * filters on `type === 'chat'`.
 */
export const ChatMsg = z.object({
  type: z.literal('chat'),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.number(), // unix ms
});
export type ChatMsg = z.infer<typeof ChatMsg>;

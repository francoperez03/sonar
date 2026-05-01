import { z } from 'zod';

export const ChatMsg = z.object({
  type: z.literal('chat'),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.number(), // unix ms
});
export type ChatMsg = z.infer<typeof ChatMsg>;

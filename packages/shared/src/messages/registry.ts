import { z } from 'zod';

export const RegisterMsg = z.object({
  type: z.literal('register'),
  runtimeId: z.string(),
  pubkey: z.string(), // Ed25519 public key, base64
});
export type RegisterMsg = z.infer<typeof RegisterMsg>;

export const RegisteredMsg = z.object({
  type: z.literal('registered'),
  runtimeId: z.string(),
});
export type RegisteredMsg = z.infer<typeof RegisteredMsg>;

export const RevokeMsg = z.object({
  type: z.literal('revoke'),
  runtimeId: z.string(),
  reason: z.string().optional(),
});
export type RevokeMsg = z.infer<typeof RevokeMsg>;

export const RevokedMsg = z.object({
  type: z.literal('revoked'),
  runtimeId: z.string(),
});
export type RevokedMsg = z.infer<typeof RevokedMsg>;

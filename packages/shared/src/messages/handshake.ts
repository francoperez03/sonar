import { z } from 'zod';

export const ChallengeMsg = z.object({
  type: z.literal('challenge'),
  nonce: z.string(),
  runtimeId: z.string(),
});
export type ChallengeMsg = z.infer<typeof ChallengeMsg>;

export const SignedResponseMsg = z.object({
  type: z.literal('signed_response'),
  runtimeId: z.string(),
  signature: z.string(),
});
export type SignedResponseMsg = z.infer<typeof SignedResponseMsg>;

export const EncryptedPayloadMsg = z.object({
  type: z.literal('encrypted_payload'),
  runtimeId: z.string(),
  ciphertext: z.string(),
  ephemeralPubkey: z.string(),
  nonce: z.string(),
});
export type EncryptedPayloadMsg = z.infer<typeof EncryptedPayloadMsg>;

export const AckMsg = z.object({
  type: z.literal('ack'),
  runtimeId: z.string(),
  status: z.enum(['ready', 'failed']),
  reason: z.string().optional(),
});
export type AckMsg = z.infer<typeof AckMsg>;

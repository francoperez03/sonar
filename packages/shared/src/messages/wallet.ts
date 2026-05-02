import { z } from 'zod';

/**
 * Phase 7 — emitted by the operator after a successful /rotation/distribute
 * runtime ack. Carries the EVM EOA the runtime received from the rotation.
 * Demo-ui uses it to label runtime cards and poll on-chain balances.
 */
export const WalletAssignedMsg = z.object({
  type: z.literal('wallet_assigned'),
  runtimeId: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  timestamp: z.number(),
});
export type WalletAssignedMsg = z.infer<typeof WalletAssignedMsg>;

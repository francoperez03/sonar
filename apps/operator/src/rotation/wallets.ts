/**
 * Ephemeral wallet generator. Per Phase 5 CONTEXT D-07.
 * Uses viem's generatePrivateKey + privateKeyToAccount — canonical EVM EOA mint.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { EphemeralWallet } from './PrivkeyVault.js';

export function generateEphemeralWallet(): EphemeralWallet {
  const privkey = generatePrivateKey(); // returns `0x${string}` (64 hex chars)
  const account = privateKeyToAccount(privkey);
  return {
    address: account.address,
    privkey,
    createdAt: Date.now(),
  };
}

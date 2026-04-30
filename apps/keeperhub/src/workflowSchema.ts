/**
 * Zod schema for the canonical KeeperHub workflow export envelope, derived from the M-05
 * dashboard dump committed at apps/keeperhub/workflow.json.
 *
 * Shape (validated against the real export, NOT the speculative flat shape sketched in
 * 05-PATTERNS.md):
 *
 *   {
 *     version: number,
 *     exportedAt: string,                       // ISO timestamp
 *     workflow: { name: string, description?: string },
 *     nodes: Array<{
 *       id: string,
 *       type: 'trigger' | 'action',
 *       position: { x: number, y: number },
 *       data: {
 *         type: 'trigger' | 'action',
 *         label: string,
 *         status: string,                       // 'idle' on a fresh dump
 *         description?: string,
 *         config: Record<string, unknown>,      // shape varies by actionType:
 *                                               //   'HTTP Request' | 'web3/transfer-funds' |
 *                                               //   'web3/write-contract' | (trigger config)
 *       },
 *     }>,
 *     edges: Array<{
 *       id: string,
 *       type: string,                           // 'animated' in the dump
 *       source: string,
 *       target: string,
 *     }>,
 *     integrationBindings: unknown[],
 *   }
 *
 * The validator only enforces cross-cutting structure. Per-action `config` field names are
 * SaaS-specific and are intentionally accepted as `record<unknown>` to remain forward-
 * compatible with KeeperHub UI changes (Phase 2 D-09 trust-boundary rule applies on the
 * outbound surface — the schema only validates that we are uploading a recognizable graph).
 */
import { z } from 'zod';

export const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'action']),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.object({
    type: z.enum(['trigger', 'action']),
    label: z.string(),
    status: z.string().optional(),
    description: z.string().optional(),
    config: z.record(z.unknown()),
  }),
});

export const EdgeSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().optional(),
  source: z.string().min(1),
  target: z.string().min(1),
});

export const WorkflowEnvelopeSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  workflow: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  nodes: z.array(NodeSchema).min(2),
  edges: z.array(EdgeSchema).min(1),
  integrationBindings: z.array(z.unknown()).optional(),
});

export type WorkflowEnvelope = z.infer<typeof WorkflowEnvelopeSchema>;
export type WorkflowNode = z.infer<typeof NodeSchema>;

/**
 * The deprecate(address[]) ABI fragment that publish-workflow.ts injects into the
 * write-contract node, replacing the UI placeholder `"Your contract abi"`.
 * Matches contracts/src/FleetRegistry.sol — the function takes an `address[]` array of
 * runtime/wallet addresses to mark deprecated on-chain.
 */
export const DEPRECATE_ABI = [
  {
    type: 'function',
    name: 'deprecate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wallets', type: 'address[]' }],
    outputs: [],
  },
] as const;

/** Default for the write-contract gas-limit multiplier (UI placeholder is "Your gas limit"). */
export const DEFAULT_GAS_LIMIT_MULTIPLIER = '1.2';

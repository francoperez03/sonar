/**
 * Pure transform that takes the raw committed workflow.json envelope + the on-chain
 * FleetRegistry address and produces the publish-ready envelope to send to KeeperHub.
 *
 * Responsibilities:
 *  1. Validate the FleetRegistry contract address present in the write-contract node
 *     matches `deployments/base-sepolia.json` (case-insensitive — the dump uses a
 *     checksum-cased address while the deployments file is lowercase).
 *  2. Inject the real `deprecate(address[])` ABI in place of the UI placeholder.
 *  3. Inject a sensible default `gasLimitMultiplier` in place of the UI placeholder.
 *  4. Rewrite the placeholder template references (`node1.wallets`, `node2.txHashes`,
 *     `node4.txHash`) to point at the real upstream node ids found by walking the edge
 *     graph. The dashboard UI emits these placeholders when the user has not yet wired
 *     them to a concrete upstream. We rewrite at publish time so the workflow is
 *     executable on first run; the user can override interactively in the UI later.
 *  5. Validate the final envelope against WorkflowEnvelopeSchema.
 *
 * Pure function so we can unit-test against in-memory fixtures without HTTP I/O.
 */
import {
  WorkflowEnvelopeSchema,
  type WorkflowEnvelope,
  DEPRECATE_ABI,
  DEFAULT_GAS_LIMIT_MULTIPLIER,
} from './workflowSchema.js';

export interface PrepareResult {
  envelope: WorkflowEnvelope;
  rewrites: string[]; // human-readable log of every transformation, surfaced via util/log
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function eqAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function prepareWorkflow(
  rawWorkflow: unknown,
  fleetRegistryAddress: string,
): PrepareResult {
  if (!ADDRESS_RE.test(fleetRegistryAddress)) {
    throw new Error(`invalid_deployment_address: ${fleetRegistryAddress}`);
  }

  // Deep-clone so we don't mutate the caller's JSON.
  const wf = JSON.parse(JSON.stringify(rawWorkflow)) as WorkflowEnvelope;
  const rewrites: string[] = [];

  if (!wf || typeof wf !== 'object' || !Array.isArray((wf as WorkflowEnvelope).nodes)) {
    throw new Error('invalid_workflow_shape');
  }

  // Identify nodes by their action signature. We look at node.data.config.actionType.
  const nodes = wf.nodes;
  const findByActionType = (actionType: string) =>
    nodes.find((n) => (n.data?.config as { actionType?: string } | undefined)?.actionType === actionType);

  const generateNode = nodes.find((n) => {
    const cfg = n.data?.config as { actionType?: string; endpoint?: string } | undefined;
    return cfg?.actionType === 'HTTP Request' && typeof cfg.endpoint === 'string' && cfg.endpoint.includes('/rotation/generate');
  });
  const transferNode = findByActionType('web3/transfer-funds');
  const writeNode = findByActionType('web3/write-contract');

  // 1. Verify the contract address.
  if (writeNode) {
    const cfg = writeNode.data.config as Record<string, unknown>;
    const onChain = cfg['contractAddress'];
    if (typeof onChain !== 'string' || !ADDRESS_RE.test(onChain)) {
      throw new Error(`write-contract node missing/invalid contractAddress: ${String(onChain)}`);
    }
    if (!eqAddress(onChain, fleetRegistryAddress)) {
      throw new Error(
        `contractAddress mismatch: workflow=${onChain} deployments=${fleetRegistryAddress}`,
      );
    }
    // Normalize to the canonical (lowercase, deployments-file) form.
    if (onChain !== fleetRegistryAddress) {
      cfg['contractAddress'] = fleetRegistryAddress;
      rewrites.push(`normalized contractAddress to ${fleetRegistryAddress}`);
    }

    // 2. Inject the real ABI if the UI placeholder is present.
    // KeeperHub web3/write-contract expects the abi as a JSON-encoded STRING (not an array),
    // otherwise the runtime serializes the array via String(obj) → "[object Object]" and fails parsing.
    if (typeof cfg['abi'] !== 'string' || !cfg['abi'].trim().startsWith('[')) {
      cfg['abi'] = JSON.stringify(DEPRECATE_ABI);
      rewrites.push('injected deprecate(address[]) ABI (json-stringified) into write-contract node');
    }

  }

  // 3. Inject a sensible gasLimitMultiplier on ANY web3 node where the UI placeholder
  // (a non-numeric string like "Your gas limit") is present.
  for (const n of nodes) {
    const cfg = n.data.config as Record<string, unknown>;
    const at = cfg['actionType'];
    if (typeof at !== 'string' || !at.startsWith('web3/')) continue;
    if (typeof cfg['gasLimitMultiplier'] === 'string'
        && !/^\d+(\.\d+)?$/.test(cfg['gasLimitMultiplier'] as string)) {
      cfg['gasLimitMultiplier'] = DEFAULT_GAS_LIMIT_MULTIPLIER;
      rewrites.push(`set gasLimitMultiplier=${DEFAULT_GAS_LIMIT_MULTIPLIER} on ${n.id}`);
    }
  }

  // 4. Rewrite placeholder template refs (node1/node2/node4) to real upstream node ids.
  // The dump shipped from the UI uses placeholder ids `node1`, `node2`, `node4` even though
  // the actual graph wires the generate webhook with id `py93u03noJDAnLHTF7dNU`. Rewriting
  // at publish time makes the workflow executable on first run.
  const placeholderToReal: Record<string, string | undefined> = {
    node1: generateNode?.id,
    node2: transferNode?.id,
    node4: writeNode?.id,
  };

  const rewriteRefsIn = (s: string): string => {
    let out = s;
    for (const [placeholder, real] of Object.entries(placeholderToReal)) {
      if (!real || real === placeholder) continue;
      // Match references like `{{ node1.wallets }}`, `{{ node2.txHashes }}`, etc.
      const re = new RegExp(`\\b${placeholder}\\b`, 'g');
      const before = out;
      out = out.replace(re, real);
      if (before !== out) {
        rewrites.push(`rewrote ${placeholder} → ${real}`);
      }
    }
    return out;
  };

  for (const node of nodes) {
    const cfg = node.data.config as Record<string, unknown>;
    for (const [k, v] of Object.entries(cfg)) {
      if (typeof v === 'string') {
        cfg[k] = rewriteRefsIn(v);
      } else if (v && typeof v === 'object') {
        // Walk one level for the forEach.input case.
        const obj = v as Record<string, unknown>;
        for (const [kk, vv] of Object.entries(obj)) {
          if (typeof vv === 'string') {
            obj[kk] = rewriteRefsIn(vv);
          }
        }
      }
    }
  }

  // 5. Validate the resulting envelope.
  const parsed = WorkflowEnvelopeSchema.safeParse(wf);
  if (!parsed.success) {
    throw new Error(`workflow_validation_failed: ${JSON.stringify(parsed.error.issues)}`);
  }

  return { envelope: parsed.data, rewrites };
}

/**
 * One-shot Node script that uploads `apps/keeperhub/workflow.json` to KeeperHub.
 *
 * Behaviour:
 *  - Reads the committed workflow.json + deployments/base-sepolia.json (Plan 02 output).
 *  - Validates the FleetRegistry address present in the write-contract node matches the
 *    deployments file (case-insensitive).
 *  - Injects the real `deprecate(address[])` ABI and a sensible gasLimitMultiplier in
 *    place of UI placeholders.
 *  - Rewrites placeholder template refs (`node1.wallets`, `node2.txHashes`, `node4.txHash`)
 *    to the real upstream node ids found in the dump.
 *  - POSTs to `/api/workflows` (create) when KEEPERHUB_WORKFLOW_ID is unset, PUTs to
 *    `/api/workflows/{id}` (update) when set.
 *  - Authorization: Bearer ${KEEPERHUB_API_TOKEN}.
 *  - On 2xx, prints `{"msg":"workflow_published","workflowId":"<id>",...}` to stdout.
 *  - On non-2xx, logs and exits non-zero.
 *
 * Importable surface: the script auto-runs ONLY when invoked as the entry point. Tests
 * import `publishWorkflow()` directly so the suite does not need to spawn `tsx`.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig, type KeeperhubConfig } from './config.js';
import { log } from './util/log.js';
import { prepareWorkflow } from './prepareWorkflow.js';

export interface PublishOptions {
  cfg?: KeeperhubConfig;
  workflowPath?: string;
  deploymentsPath?: string;
}

export interface PublishResult {
  workflowId: string;
  method: 'POST' | 'PATCH';
  url: string;
  rewrites: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));

export async function publishWorkflow(opts: PublishOptions = {}): Promise<PublishResult> {
  const cfg = opts.cfg ?? getConfig();
  const workflowPath = opts.workflowPath
    ?? resolve(HERE, '..', 'workflow.json');
  const deploymentsPath = opts.deploymentsPath
    ?? resolve(HERE, '..', '..', '..', 'deployments', 'base-sepolia.json');

  const rawWorkflow = JSON.parse(await readFile(workflowPath, 'utf8')) as unknown;
  const deployments = JSON.parse(await readFile(deploymentsPath, 'utf8')) as {
    FleetRegistry: { address: string };
  };
  const fleetRegistryAddress = deployments.FleetRegistry.address;

  const { envelope, rewrites } = prepareWorkflow(rawWorkflow, fleetRegistryAddress);
  for (const r of rewrites) log({ msg: 'workflow_rewrite', detail: r });

  const isUpdate = Boolean(cfg.workflowId);
  const url = isUpdate
    ? `${cfg.apiBaseUrl}/api/workflows/${cfg.workflowId}`
    : `${cfg.apiBaseUrl}/api/workflows/create`;
  const method: 'POST' | 'PATCH' = isUpdate ? 'PATCH' : 'POST';

  const body = {
    name: envelope.workflow.name,
    description: envelope.workflow.description ?? '',
    nodes: envelope.nodes,
    edges: envelope.edges,
  };

  const res = await fetch(url, {
    method,
    headers: {
      'authorization': `Bearer ${cfg.apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log({ msg: 'publish_failed', status: res.status, body: body.slice(0, 500) });
    throw new Error(`publish_failed status=${res.status}`);
  }

  const out = (await res.json().catch(() => ({}))) as { id?: string };
  const workflowId = out.id ?? cfg.workflowId ?? 'unknown';
  log({ msg: 'workflow_published', workflowId, method, url });
  return { workflowId, method, url, rewrites };
}

// Auto-run guard: only execute when invoked directly, not on test import.
const invokedDirectly = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  try {
    await publishWorkflow();
  } catch (e) {
    log({ msg: 'publish_fatal', err: String(e) });
    process.exit(1);
  }
}

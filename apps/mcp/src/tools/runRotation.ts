/**
 * MCP tool: run_rotation (CONTEXT D-08, D-09, D-20).
 *
 * DESTRUCTIVE: triggers a KeeperHub workflow run that generates fresh EOAs, funds them,
 * distributes to runtimes, and deprecates old wallets on Base Sepolia. Returns runId
 * immediately; on-chain progress is observed via the Phase 4 get_workflow_log tool.
 *
 * Input  (ZodRawShape — bare object per RESEARCH Pattern 2 / Pitfall 2):
 *   { runtimeIds: string[] (min 1) }
 *   walletCount is REMOVED per D-09 — wallet count is strictly runtimeIds.length.
 *
 * Output:
 *   On success:    { content: [text], structuredContent: { runId, runtimeIds, walletCount, pollerRegistered } }
 *   On KH failure: mcpError('keeperhub_unavailable', '... <code>')
 *   On not-cfg:    mcpError('keeperhub_not_configured', '...')
 *
 * Failure-tolerant on poller side: poller-down does NOT fail the tool — the runId is
 * still surfaced to Claude with structuredContent.pollerRegistered=false plus a
 * warning text so the operator knows tx hashes won't mirror to the LogBus until
 * apps/keeperhub is reachable again.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { triggerKeeperhubRun, type KeeperhubCtx } from '../keeperhub/http.js';
import { registerRunWithPoller } from '../keeperhub/runRegistry.js';
import { mcpError } from './_shared.js';

export interface RunRotationCtx extends KeeperhubCtx {
  pollerBaseUrl: string;
  webhookSecret: string;
}

export function registerRunRotation(server: McpServer, ctx: RunRotationCtx): void {
  server.registerTool(
    'run_rotation',
    {
      title: 'Run rotation',
      description:
        'DESTRUCTIVE. Triggers a KeeperHub workflow run that generates fresh EOAs, funds them, ' +
        'distributes to runtimes, and deprecates old wallets on Base Sepolia. Returns runId ' +
        'immediately; poll progress via get_workflow_log.',
      inputSchema: {
        runtimeIds: z
          .array(z.string().min(1))
          .min(1)
          .describe(
            'Runtime IDs to rotate (1:1 mapping with generated wallets, ordered). ' +
              'Wallet count is strictly derived from runtimeIds.length per D-09.',
          ),
        // walletCount intentionally OMITTED — D-09 locks 1:1 mapping.
      },
    },
    async ({ runtimeIds }) => {
      if (!ctx.apiToken || !ctx.workflowId) {
        return mcpError(
          'keeperhub_not_configured',
          'KEEPERHUB_API_TOKEN and KEEPERHUB_WORKFLOW_ID must be set in apps/mcp/.env (see Plan 04 M-06).',
        );
      }

      let runId: string;
      try {
        const out = await triggerKeeperhubRun(ctx, { runtimeIds });
        runId = out.runId;
      } catch (e) {
        const code = e instanceof Error ? e.message.replace(/^http_/, '') : 'unknown';
        return mcpError('keeperhub_unavailable', `KeeperHub run-trigger failed: ${code}`);
      }

      const regResult = await registerRunWithPoller(
        { pollerBaseUrl: ctx.pollerBaseUrl, webhookSecret: ctx.webhookSecret },
        runId,
      );

      const text = regResult.ok
        ? `runId: ${runId}\nWatch progress with get_workflow_log.`
        : `runId: ${runId}\nWarning: poller registration failed (status=${regResult.status ?? 'unreachable'}); tx hashes will not be mirrored to LogBus until apps/keeperhub is reachable. Run is still active in KeeperHub.`;

      return {
        content: [{ type: 'text' as const, text }],
        structuredContent: {
          runId,
          runtimeIds,
          walletCount: runtimeIds.length, // strictly derived per D-09
          pollerRegistered: regResult.ok,
        },
      };
    },
  );
}

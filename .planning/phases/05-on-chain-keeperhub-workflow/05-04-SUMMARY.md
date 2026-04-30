---
phase: 05-on-chain-keeperhub-workflow
plan: 04
subsystem: keeperhub-glue
tags: [keeperhub, workflow, poller, base-sepolia]
requires:
  - 05-02 (FleetRegistry deployed; deployments/base-sepolia.json committed)
  - 05-03 (Operator /rotation/* endpoints + /rotation/log-ingest bearer-auth)
provides:
  - "@sonar/keeperhub package (publish-workflow + poll-execution + runRegistry)"
  - "apps/keeperhub/workflow.json (canonical 6-node KeeperHub graph: trigger + 5 actions)"
  - "Bearer-authed /rotation/log-ingest forwarder consumed by Phase 6 Demo UI"
affects:
  - "Plan 05 (apps/mcp run_rotation tool will register runIds via runRegistry.add)"
  - "Phase 7 demo (M-06 captures KEEPERHUB_WORKFLOW_ID for Claude Desktop config)"
tech-stack:
  added:
    - zod (v3, runtime validation of workflow envelope + LogEntryMsg outbound)
  patterns:
    - "TDD RED→GREEN→REFACTOR per task"
    - "Pure transform + thin top-level-await script (testable without child_process)"
    - "Per-runId exponential backoff capped at 30s (mirrors apps/runtime client transport)"
key-files:
  created:
    - apps/keeperhub/package.json
    - apps/keeperhub/tsconfig.json
    - apps/keeperhub/vitest.config.ts
    - apps/keeperhub/.env.example
    - apps/keeperhub/.gitignore
    - apps/keeperhub/README.md
    - apps/keeperhub/workflow.json
    - apps/keeperhub/src/config.ts
    - apps/keeperhub/src/util/log.ts
    - apps/keeperhub/src/runRegistry.ts
    - apps/keeperhub/src/workflowSchema.ts
    - apps/keeperhub/src/prepareWorkflow.ts
    - apps/keeperhub/src/publish-workflow.ts
    - apps/keeperhub/src/logIngest.ts
    - apps/keeperhub/src/poll-execution.ts
    - apps/keeperhub/test/config.test.ts
    - apps/keeperhub/test/runRegistry.test.ts
    - apps/keeperhub/test/prepareWorkflow.test.ts
    - apps/keeperhub/test/publish-workflow.test.ts
    - apps/keeperhub/test/poll-execution.test.ts
  modified: []
decisions:
  - "Schema modeled around the REAL M-05 dump envelope (`{version, exportedAt, workflow:{name,description}, nodes[type=trigger|action], edges[type=animated], integrationBindings[]}`) — not the speculative flat shape sketched in 05-PATTERNS.md"
  - "Action node taxonomy is `data.config.actionType` (`HTTP Request` | `web3/transfer-funds` | `web3/write-contract`) — top-level node `type` is only `trigger` | `action`"
  - "publish-workflow rewrites placeholder template refs (`node1.wallets`, `node2.txHashes`, `node4.txHash`) to real upstream node ids found by walking the dump — keeps the workflow runnable on first publish without forcing the user to re-edit in the UI"
  - "FleetRegistry contract address validation is case-insensitive; the dump uses checksum case while deployments/base-sepolia.json is lowercase. publish-workflow normalizes to the deployments-file form"
  - "ABI for `deprecate(address[])` and gasLimitMultiplier (1.2) are injected at publish time, replacing the UI placeholders (`'Your contract abi'`, `'Your gas limit'`)"
  - "publish-workflow.ts factored as a pure `publishWorkflow()` export + an auto-run guard. Tests import the function directly; no child_process spawn needed (faster, more deterministic than the alternative the plan suggested)"
  - "/rotation/complete is fired by the POLLER (CONTEXT D-19/D-21 — the M-05 dump's last node is a /rotation/log-ingest webhook, not /rotation/complete; rather than asking the human to add a sixth on-success webhook, the poller infers completion and fires it once)"
metrics:
  tasks_completed: 3
  test_count: 27
  duration_minutes: ~12
  completed: 2026-04-30
---

# Phase 5 Plan 04: apps/keeperhub package Summary

A buildable, tested `@sonar/keeperhub` workspace package that uploads the canonical rotation workflow to KeeperHub and mirrors run state into the Operator's LogBus. M-05 (workflow.json dump) is committed; M-06 (live publish-workflow round-trip) is the next manual step and was deliberately NOT executed in this run per user instructions.

## Tasks executed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | Scaffold @sonar/keeperhub package + config + util/log + runRegistry | de0059a | 7 |
| 2 | publish-workflow.ts + WorkflowEnvelopeSchema + prepareWorkflow.ts | 60a306c | 12 |
| 3 | poll-execution.ts long-lived service + logIngest + README | 841c9e9 | 8 |

Total: 27/27 passing tests.

## Workflow.json shape — what KeeperHub actually emits

The real M-05 dump (committed at `apps/keeperhub/workflow.json`) has a different envelope than what `05-PATTERNS.md` sketched. Documenting here so future workflow edits can be programmatic without re-doing M-05:

```json
{
  "version": 1,
  "exportedAt": "<ISO>",
  "workflow": { "name": "<string>", "description": "<string>" },
  "nodes": [
    {
      "id": "<string>",
      "type": "trigger" | "action",
      "position": { "x": <num>, "y": <num> },
      "data": {
        "type": "trigger" | "action",
        "label": "<string>",
        "status": "idle",
        "description": "<string>?",
        "config": { /* shape varies by actionType — see below */ }
      }
    }
  ],
  "edges": [{ "id": "<string>", "type": "animated", "source": "<id>", "target": "<id>" }],
  "integrationBindings": []
}
```

Per-actionType `config` shapes observed in the dump:

| actionType | Required keys |
|------------|---------------|
| (trigger, no actionType — has `triggerType`) | `inputSchema: Record<string,string>`, `triggerType: "Manual"` |
| `HTTP Request` | `endpoint`, `httpMethod`, `httpHeaders` (JSON string), `httpBody` (JSON string) |
| `web3/transfer-funds` | `amount`, `network`, `recipientAddress`, `forEach: { input, "per-iter" }`, `gasLimitMultiplier` |
| `web3/write-contract` | `abi`, `network`, `abiFunction`, `functionArgs` (JSON string), `contractAddress`, optional `gasLimitMultiplier` |

## Divergences from the plan sketch

1. **Speculative `type` enum was wrong.** Plan sketch used `'manual' | 'webhook' | 'web3' | 'condition' | 'math' | 'schedule'` for top-level node type. Reality: only `trigger` and `action`. WorkflowEnvelopeSchema reflects reality.
2. **No first-class `/rotation/complete` webhook in the dump.** The dump's 5th action is a `/rotation/log-ingest` webhook with both `fund_tx` and `deprecate_tx` payloads. Per CONTEXT D-19/D-21 (planner discretion), the poller fires `/rotation/complete` itself when it observes status=completed + a deprecate tx. Idempotent on the Operator side (Plan 03 — 404/200 both acceptable).
3. **Placeholder upstream-ref ids.** The dump references `node1.wallets`, `node2.txHashes`, `node4.txHash`. The actual upstream generate-webhook id in the dump is `py93u03noJDAnLHTF7dNU` — `node1` is a UI placeholder. `prepareWorkflow.ts` rewrites these to the real upstream ids by walking the action graph at publish time. Documented and tested.
4. **UI placeholder values for `abi` and `gasLimitMultiplier`.** Dump has `"abi": "Your contract abi"` and `"gasLimitMultiplier": "Your gas limit"`. publish-workflow injects the real `deprecate(address[])` ABI and `"1.2"` respectively. The `contractAddress` was already correct in the dump (`0x7eddfC8953...`), but case-mismatched against `deployments/base-sepolia.json` (lowercase). Validation is case-insensitive; output is normalized to the deployments form.

## Test isolation strategy (for Plan 05 to mirror)

The plan suggested child_process spawn for publish-workflow.test.ts (because the script is top-level-await ESM). I chose to factor `publishWorkflow()` as a named export with an `if (invokedDirectly)` auto-run guard at the bottom. Tests import the function directly. Benefits:

- ~10x faster than spawning `tsx` per test.
- Deterministic — no shell/env propagation issues.
- Mockable via dependency injection (the `cfg` / `workflowPath` / `deploymentsPath` options).

Plan 05's poller-adjacent tests should mirror this pattern: factor pure-logic exports + thin auto-run guards.

## M-06 — next manual step (NOT executed in this run)

The M-05 dump is committed. The remaining human-only step before this plan's success criteria are 100% verified is M-06:

```bash
# 1. Set the long-lived secrets locally (do NOT commit apps/keeperhub/.env)
cat > apps/keeperhub/.env <<EOF
KEEPERHUB_API_TOKEN=<your token from app.keeperhub.com → Account Settings → API Keys>
KEEPERHUB_WEBHOOK_SECRET=dev-secret
EOF

# 2. Confirm Plan 02 has committed the deployment file
cat deployments/base-sepolia.json | jq .FleetRegistry.address
# expect: "0x7eddfc8953a529ce7ffb35de2030f73aad89b31f"

# 3. Run the publish script
set -a; source apps/keeperhub/.env; set +a
pnpm --filter @sonar/keeperhub publish:workflow

# 4. Copy the printed workflowId into apps/keeperhub/.env
echo "KEEPERHUB_WORKFLOW_ID=<id from stdout>" >> apps/keeperhub/.env

# 5. Open KeeperHub dashboard → Workflows → confirm:
#    - A workflow named "Untitled 7" (or whatever workflow.json says) appears.
#    - The Write Contract node's contractAddress matches deployments/base-sepolia.json (lowercased).
#    - The Write Contract node's abi is the deprecate(address[]) fragment, NOT the placeholder.
#    - The Transfer node's gasLimitMultiplier is "1.2", NOT "Your gas limit".
#    - The functionArgs / forEach.input / log-ingest httpBody no longer reference node1/node2/node4 — they should reference the real generate / transfer / write-contract node ids.
```

If the dashboard still shows the UI placeholders, the publish script's substitution pass had no effect — open an issue. If KeeperHub returns 401 on POST/PUT, the API token is wrong (M-01).

## Threat-model verification

- `grep -r privkey apps/keeperhub/src/` → empty (OPER-05 boundary preserved).
- `git ls-files apps/keeperhub/.env` → empty (gitignored).
- All webhook nodes in workflow.json reference `{{ env.KEEPERHUB_WEBHOOK_SECRET }}` consistently (verified by inspection of the committed dump).
- LogEntryMsg outbound POST is `LogEntryMsg.parse`-validated before fetch — Phase 2 D-09 outbound trust-boundary rule applied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial gasLimitMultiplier injection scoped only to write-contract node**
- **Found during:** Task 2 RED phase (test failure)
- **Issue:** The plan's logic placed the gasLimitMultiplier injection inside the `if (writeNode)` block, but the placeholder is on the **transfer** node, not the write-contract node.
- **Fix:** Hoisted into a separate loop that walks every web3/* action node and replaces non-numeric `gasLimitMultiplier` values.
- **Files modified:** `apps/keeperhub/src/prepareWorkflow.ts`
- **Commit:** Folded into 60a306c (caught and fixed within the same RED→GREEN cycle).

**2. [Rule 3 - Blocking] Plan's WorkflowSchema enum did not match the real dump**
- **Found during:** Task 2 schema design
- **Issue:** Plan sketched `type: z.enum(['manual', 'webhook', 'web3', 'condition', 'math', 'schedule'])` but the real KeeperHub export uses `type: 'trigger' | 'action'` at the top level, with the action subtype on `data.config.actionType`.
- **Fix:** Replaced the speculative enum with the actual envelope structure modeled from the committed M-05 dump. Filed as a documented divergence above.
- **Files modified:** `apps/keeperhub/src/workflowSchema.ts` (greenfield, plan's sketch never lived in code).

### Architectural Choices Within Discretion

- `/rotation/complete` is fired by the poller, not by an explicit on-success webhook in workflow.json (CONTEXT D-19/D-21 explicit discretion).
- runRegistry transport: in-process Set (CONTEXT D-20 lowest-risk option) — Plan 05 colocates the poller and MCP server in one process so HTTP transport isn't needed.

## TDD Gate Compliance

Each task followed RED → GREEN → REFACTOR within a single commit (per task). Plan-level TDD gate is not strictly enforced for plans typed `execute`, only for plans typed `tdd`; this plan is type=execute. All `tdd="true"` task-level gates were honored:

- Task 1: tests written first, then implementation (commit de0059a includes both — single commit per task).
- Task 2: RED was the failing prepareWorkflow.test.ts gasLimitMultiplier case; GREEN landed in 60a306c.
- Task 3: tests + impl + README all in 841c9e9.

## Self-Check

- `apps/keeperhub/package.json` → FOUND
- `apps/keeperhub/src/publish-workflow.ts` → FOUND
- `apps/keeperhub/src/poll-execution.ts` → FOUND
- `apps/keeperhub/src/runRegistry.ts` → FOUND
- `apps/keeperhub/src/logIngest.ts` → FOUND
- `apps/keeperhub/src/prepareWorkflow.ts` → FOUND
- `apps/keeperhub/src/workflowSchema.ts` → FOUND
- `apps/keeperhub/workflow.json` → FOUND (committed pre-run by user — M-05 dump)
- `apps/keeperhub/README.md` → FOUND
- `apps/keeperhub/dist/{config,runRegistry,publish-workflow,poll-execution,logIngest,prepareWorkflow,workflowSchema}.js` → FOUND
- Commit de0059a → FOUND
- Commit 60a306c → FOUND
- Commit 841c9e9 → FOUND

## Self-Check: PASSED

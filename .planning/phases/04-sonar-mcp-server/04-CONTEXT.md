# Phase 4: Sonar MCP Server - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers a Node MCP server (`apps/mcp`) that lets Claude Desktop drive the local Operator through three tools — `list_runtimes`, `revoke`, `get_workflow_log` — over stdio. The server is a thin adapter on top of the Phase 3 Operator HTTP routes (`GET /runtimes`, `POST /revoke`) and the broadcast log WS (`ws://operator/logs`). Install instructions in the README must get a fresh developer connected from Claude Desktop in under 5 minutes (MCP-03).

In scope:
- `apps/mcp` MCP server using `@modelcontextprotocol/sdk`, stdio transport
- Three tools: `list_runtimes`, `revoke`, `get_workflow_log` with locked I/O schemas (see decisions)
- Persistent WS subscription to `ws://operator/logs` at boot, in-memory ring buffer (~500 events) backing `get_workflow_log`
- HTTP client to Operator for `list_runtimes` + `revoke`
- Reconnect loop with exponential backoff when Operator is unreachable; tools return structured MCP errors during outage
- README install: clone+install → start operator → paste `claude_desktop_config.json` snippet → restart Claude Desktop, plus the three tool examples
- Env-var config with localhost defaults

Out of scope (later phases or deferred):
- KeeperHub workflow integration (Phase 5)
- `distribute` exposed as MCP tool (KeeperHub triggers `/distribute` directly in Phase 5; not exposed to Claude Desktop)
- FleetRegistry on-chain reads (Phase 5)
- Demo UI mirroring of MCP tool output (Phase 6)
- AXL transport (Phase 6)
- npm publish of `@sonar/mcp` (deferred — local node path is enough for demo)
- HTTP/SSE transport for the MCP server (deferred — stdio only)
- Auth between MCP server and Operator (single-tenant demo, matches Phase 3 D-14)
- Resource subscriptions / MCP notifications for live log streaming (deferred — request/response only)
- Cursor/since pagination on `get_workflow_log` (deferred — snapshot-of-buffer is enough)
- Persistent log buffer across MCP-server reboots (memory-only, like the runtime keypairs)

</domain>

<decisions>
## Implementation Decisions

### Transport & SDK
- **D-01:** **stdio transport only.** Claude Desktop spawns the MCP server as a child process and speaks JSON-RPC over stdin/stdout. No HTTP/SSE in Phase 4 — adds setup friction with no demo benefit.
- **D-02:** **`@modelcontextprotocol/sdk` (official TS SDK)** for the MCP server. Provides stdio transport, tool registration, JSON-Schema/zod input validation. No hand-rolled JSON-RPC.

### Operator Connection
- **D-03:** **Persistent WS to `ws://operator/logs` at boot**, behind an exponential-backoff reconnect loop (cap ~30s, retries forever — same shape as Phase 3 D-11 runtime reconnect). The MCP server stays alive even when Operator is down; tools that need Operator return a structured MCP error `{ code: 'operator_unavailable' }` instead of crashing.
- **D-04:** **HTTP calls for `list_runtimes` and `revoke`.** Standard `fetch` against the Operator HTTP routes. No HTTP keep-alive complexity needed — these are infrequent.
- **D-05:** **No auth header / shared secret.** Matches Phase 3 D-14 (single-tenant demo).

### Log Buffer (`get_workflow_log`)
- **D-06:** **In-memory ring buffer, default size 500 events.** The MCP server consumes every `log_entry` and `status_change` from the WS subscription and pushes into a fixed-size ring. Older events are evicted on overflow.
- **D-07:** **Snapshot semantics — no cursor / no subscription / no notifications.** `get_workflow_log` returns the most recent N events from the ring at call time. Simpler than cursor pagination, fits Claude Desktop's request/response UX, and is sufficient for the demo's "what just happened" forensic prompts.
- **D-08:** **Buffer is memory-only.** Lost on MCP-server restart. Matches the project's non-custodial / demo-grade ethos and avoids file-IO race conditions.

### Tool I/O Schemas

#### `list_runtimes`
- **D-09:** Input: `{}` (no parameters).
- **D-10:** Output: `{ runtimes: Array<{ runtimeId, status, registeredAt, lastHandshakeAt? }> }` — passthrough of Operator `GET /runtimes`. `status` enum matches the locked Phase 2 `StatusChangeMsg`: `registered | awaiting | received | deprecated | revoked`.

#### `revoke`
- **D-11:** Input: `{ runtimeId: string, reason?: string }`. No `confirm` flag — Claude Desktop already shows the user a tool-call approval prompt before executing.
- **D-12:** Output: `{ ok: true, status: 'revoked' }` on success; structured MCP error on failure (operator_unavailable | runtime_not_found | already_revoked).
- **D-13:** Reason is appended to the Operator's `log_entry` for forensic traceability when present.

#### `get_workflow_log`
- **D-14:** Input: `{ limit?: number = 50, runtimeId?: string }`. `limit` clamped to `[1, 500]` (the buffer size). `runtimeId` filters before the limit is applied.
- **D-15:** Output: `{ events: Array<{ ts, runtimeId, type, payload }> }` — structured JSON, not pre-formatted text. Claude reasons over JSON better and can filter/summarize on demand.

### Config & Distribution
- **D-16:** **Env-var config with localhost defaults:**
  - `OPERATOR_HTTP_URL` (default `http://localhost:8787`)
  - `OPERATOR_LOGS_WS` (default `ws://localhost:8787/logs`)
  - `LOG_BUFFER_SIZE` (default `500`) — Claude's discretion if it stays in
- **D-17:** **Distribution: local node path, not npm.** `claude_desktop_config.json` runs `node /abs/path/to/sonar/apps/mcp/dist/index.js`. The README walks the user through `pnpm install && pnpm --filter @sonar/mcp build`. Demo-appropriate; npm publish is deferred.

### README (MCP-03)
- **D-18:** README contains, in order:
  1. The `claude_desktop_config.json` snippet with placeholder for the local path
  2. Three setup steps: clone+install+build, `pnpm dev:operator` (Phase 3 script), paste snippet & restart Claude Desktop
  3. Tool catalog with one example prompt per tool ("List my runtimes", "Revoke alpha because clone detected", "Show the last 50 log events for beta")
- **D-19:** README is a single file at `apps/mcp/README.md`. No troubleshooting section in v1 (Claude's discretion to add a short one if time allows during planning).

### Claude's Discretion
- Internal directory layout under `apps/mcp/src/` (e.g., `tools/`, `operator/`, `buffer/`) — pick during planning
- Specific @modelcontextprotocol/sdk APIs (`Server` vs `McpServer` helper, etc.) — pick whatever the current SDK docs recommend
- WebSocket client library — `ws` for consistency with the Operator side, unless the SDK bundles one
- HTTP client — native `fetch` is fine; `undici` only if there's a clear reason
- Log-event TypeScript shape — derive from Phase 2 `LogEntryMsg` / `StatusChangeMsg` schemas; don't redefine
- Error-mapping strategy from HTTP/WS failures to MCP error codes — sensible default ok
- Whether to include a minimal `apps/mcp/README.md` "troubleshooting" section if planning estimates allow
- Tool description strings (the prompts Claude Desktop shows) — Claude picks during planning, must mention destructive-action semantics on `revoke`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core Value, threat model, custody model
- `.planning/REQUIREMENTS.md` §MCP (MCP-01, MCP-02, MCP-03) — the 3 v1 requirements this phase delivers
- `.planning/ROADMAP.md` §"Phase 4: Sonar MCP Server" — goal, dependencies, success criteria
- `CLAUDE.md` — Tech stack constraints (TypeScript, Node 20+, pnpm, ESM)

### Locked upstream contracts
- `.planning/phases/02-workspace-foundation/02-CONTEXT.md` — `ITransport` decisions, message schemas (`LogEntryMsg`, `StatusChangeMsg`, `StatusChange` enum)
- `.planning/phases/03-operator-runtime-identity-core/03-CONTEXT.md` §decisions D-10, D-13, D-14 — operator HTTP routes (`/runtimes`, `/revoke`, `/distribute`), `ws://operator/logs` broadcast, no-auth single-tenant model
- `apps/operator/src/http/routes/runtimes.ts` — exact response shape Phase 4 must passthrough
- `apps/operator/src/http/routes/revoke.ts` — exact request/response shape
- `apps/operator/src/log/LogBus.ts`, `apps/operator/src/log/logSubscribers.ts` — log event shape and broadcast semantics
- `packages/shared/src/messages/log.ts` — `LogEntryMsg` / `StatusChangeMsg` zod schemas (source of truth for buffer/event types)
- `apps/mcp/package.json` — current scaffold; Phase 4 adds dependencies

### External docs
- `@modelcontextprotocol/sdk` — official TypeScript SDK; planning agent should read latest README/quickstart for current `Server` constructor + tool registration APIs
- Anthropic MCP quickstart for Claude Desktop — `claude_desktop_config.json` schema for stdio servers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mcp` already scaffolded (package.json with `@sonar/shared` dep, tsx dev script, tsc build); just needs real implementation
- `packages/shared/src/messages/log.ts` — log message zod schemas; reuse for buffer typing instead of redefining
- `apps/operator/src/log/LogBus.ts` + `logSubscribers.ts` — reference for WS event shape produced upstream
- `apps/operator/src/http/routes/runtimes.ts`, `revoke.ts` — reference for response shapes the MCP server passthroughs

### Established Patterns
- ESM-only TypeScript, Node 20+, pnpm workspace (matches Phase 3)
- Vitest for tests (introduced Phase 3)
- Env-var config with sensible defaults (Phase 3 D-20 set the precedent)
- Structured JSON logging via simple console wrapper (matches Phase 3 `apps/operator/src/util/log.ts`)
- Reconnect loop with exponential backoff already implemented client-side in `apps/runtime/src/transport/createClientTransport.ts` — Phase 4 should mirror its shape (and may even import the helper if it's generic enough; otherwise re-implement to avoid leaking runtime-specific concerns)

### Integration Points
- MCP server reads from Operator HTTP (`OPERATOR_HTTP_URL`) + WS (`OPERATOR_LOGS_WS`)
- Claude Desktop is the only consumer in Phase 4 (Phase 6 demo UI consumes `/logs` directly, not via MCP)
- Phase 5 KeeperHub workflow does NOT go through MCP — it triggers `/distribute` on the Operator directly

</code_context>

<specifics>
## Specific Ideas

- README's three example prompts should mirror demo-day moments: "list my runtimes", "revoke alpha because a clone showed up", "show me the last 50 log events for beta". These double as MCP-02 acceptance evidence.
- Tool description strings shown to Claude Desktop should explicitly mark `revoke` as destructive ("permanently revokes the runtime; further handshakes will fail") so the Claude Desktop UI's tool-approval prompt makes sense to the user.

</specifics>

<deferred>
## Deferred Ideas

- HTTP/SSE transport variant for remote MCP usage — would unlock multi-machine demos but adds gateway/auth surface. Revisit post-demo.
- npm publish (`npx @sonar/mcp`) — better install ergonomics for reviewers, deferred until after the v1 ship.
- Cursor/since pagination on `get_workflow_log` — only matters if Claude polls aggressively. Add when usage data justifies it.
- MCP resource subscriptions / live notifications for the log stream — protocol-correct but Claude Desktop UX is weak; revisit when client support matures.
- A `distribute` MCP tool — out of scope; Phase 5 wires KeeperHub directly to `/distribute`. Could be added later if interactive distribution from Claude Desktop becomes a use case.
- Auth/shared-secret between MCP server and Operator — required only when single-tenant assumption breaks (multi-user / hosted scenarios).
- Persistent log buffer across reboots — only matters once log retention has product value.

</deferred>

---

*Phase: 04-sonar-mcp-server*
*Context gathered: 2026-04-29*

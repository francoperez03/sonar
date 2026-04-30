# Phase 6: Demo UI + AXL Transport - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `apps/demo-ui` — a React (Vite + React 18) demo that visualizes a live KeeperHub rotation run end-to-end:
- **Chat mirror** of Claude Desktop prompts/responses (DEMO-01)
- **Live log stream** from the Operator WebSocket (DEMO-02)
- **Per-runtime panels** for `alpha`, `beta`, `gamma` showing the full status arc `registered → awaiting → received → deprecated`, plus `revoked` and `clone-rejected` (DEMO-03)
- **AXL transport** under the existing `ITransport` interface, implemented OR explicitly deferred via the deferred-decision policy with WebSocket recorded as the demo transport in `docs/` (TRAN-03)

Not in scope: dashboards beyond the live demo run, multi-tenant operator views, real-time editing of rotation config from the UI, mainnet, persistence beyond what the Operator already has.

</domain>

<decisions>
## Implementation Decisions

### Layout & Visual Style
- **D-01:** Adopt the foja `apps/demo` shell topology — `AmbientBackground` + `Sidebar` (left) + `Canvas` (center) + `Footer` (bottom). Port components and dynamics, not intent or copy.
- **D-02:** Sidebar stack: **ChatMirror on top**, **EventLog (WS log stream) below**. Both are temporal, top-down narrative feeds and pair naturally.
- **D-03:** Canvas hosts the runtime nodes (the visual hero of the demo) plus service icons for Operator, KeeperHub, and Chain (FleetRegistry on Base Sepolia).
- **D-04:** Footer surfaces on-chain status: last `WalletsDeprecated` tx hash with Base Sepolia explorer link, plus a "Run again" CTA.
- **D-05:** **Reuse landing design tokens directly** — import from `apps/landing/src/styles/tokens.{css,ts}` (or promote to a shared package if needed during planning). One palette across landing + demo for product coherence.
- **D-06:** Use **framer-motion + AmbientBackground** ported from foja. Adopt foja's motion vocabulary (`LayoutGroup`, `AnimatePresence`) for runtime status transitions, log row entry, and page-state changes.

### Chat Mirror (DEMO-01)
- **D-07:** **Source = live capture via Operator log channel.** MCP server emits a new chat-typed log event (e.g. `kind: "chat"` with `role` + `content`) to the Operator's LogBus when `run_rotation` (or any chat-relevant tool) is invoked. UI subscribes to the same WS log stream and filters chat events.
- **D-08:** **Presentation = bubble chat (user / assistant)** — alternating bubbles, readable on the demo video for non-technical viewers.
- **D-09:** A new chat log type/shape MUST be added to `packages/shared/messages/*` so MCP, Operator, and UI agree on the contract. (Surface in plan tasks.)

### Runtime Panels (DEMO-03)
- **D-10:** Each runtime node renders **status pill + identity strip**: pill = `registered | awaiting | received | deprecated | revoked | clone-rejected`; identity strip = truncated pubkey (e.g. `4..4` ellipsis) + last-event timestamp.
- **D-11:** Render **four nodes total**: `alpha`, `beta`, `gamma`, plus a fourth **ghost `gamma-clone`** that flashes red `clone-rejected` when the clone-rejection event fires during the demo. This is the cinematic showcase of the project's core value (OWASP LLM06 / clone resistance).
- **D-12:** Show service icons for Operator, KeeperHub, Chain on canvas with **animated cyan lines pulsing along edges** during each workflow step (matches the sonar ping/echo metaphor from the landing).

### AXL Transport (TRAN-03)
- **D-13:** **Researcher MUST run a strong, focused investigation of Gensyn AXL** before planning produces the AXL/defer decision. All public AXL API surface, auth model, message shapes, transport semantics, SDK status, integration touchpoints, and known gotchas should be in `06-RESEARCH.md`. The attempt-vs-spike-vs-defer decision is intentionally postponed until after that research lands. (Was originally going to default to "defer up front"; user explicitly upgraded this to a research-first decision.)
- **D-14:** Independent of the AXL outcome, the **demo UI subscribes to the Operator via an `ITransport` client adapter** — not raw `new WebSocket()`. Reuse or thinly wrap the runtime's client transport. This keeps the swap-ability claim honest end-to-end and means the same UI binary will run against AXL or WS without code changes.
- **D-15:** If AXL is deferred after research, write `docs/decisions/axl-deferred.md` recording rationale + WS as recorded fallback (satisfies TRAN-03's fallback clause) — and surface that doc in Phase 7's submission package.

### Claude's Discretion
- Exact canvas geometry (node placement, edge curves, ambient particle density)
- Specific framer-motion easing curves and durations (within foja's vocabulary)
- ChatMirror auto-scroll, copy-to-clipboard, expand-long-message UX details
- EventLog filtering chips (e.g. all / chat / handshake / on-chain) — add if cheap, skip otherwise
- Empty/idle states before the first run
- Footer layout details and explorer link styling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 6: Demo UI + AXL Transport" — goal, dependencies, success criteria
- `.planning/REQUIREMENTS.md` — DEMO-01, DEMO-02, DEMO-03, TRAN-03 entries
- `.planning/PROJECT.md` §Constraints, §Deferred Decisions — non-custodial invariant, AXL fallback policy

### Visual/component reference (port components, not intent)
- `../foja/apps/demo/src/App.tsx` — two-phase shell pattern (hero → shell)
- `../foja/apps/demo/src/components/shell/AmbientBackground.tsx` — ambient bg layer
- `../foja/apps/demo/src/components/shell/IssuerSidebar.tsx` — sidebar shell
- `../foja/apps/demo/src/components/shell/DemoFooter.tsx` — footer pattern
- `../foja/apps/demo/src/components/sidebar/EventLog.tsx` — log stream component analog
- `../foja/apps/demo/src/components/canvas/` — canvas + node rendering
- `../foja/apps/demo/src/components/primitives/AgentRow.tsx` — node primitive
- `../foja/apps/demo/package.json` — versions of `framer-motion`, `react`, `vite` to mirror

### Sonar palette / design tokens (reuse, do not redesign)
- `apps/landing/src/styles/tokens.css` — CSS custom properties (cyan/blue/off-white dark theme)
- `apps/landing/src/styles/tokens.ts` — TS token map
- `apps/landing/src/test/tokens.test.ts` — token contract tests (preserve invariants if promoting tokens to a shared package)

### Transport + message contracts (UI consumes via ITransport)
- `packages/shared/transport.ts` — `ITransport` interface
- `packages/shared/messages/` — message shape types (extend with chat event in this phase)
- `apps/operator/src/transport/` — server transport implementation (WS upgrade)
- `apps/runtime/src/transport/` (or equivalent) — client transport reference for the UI adapter
- `apps/operator/src/log/LogBus.ts` (or wherever LogBus lives) — log event publication; chat events route through here
- `.planning/phases/03-operator-runtime-identity-core/03-CONTEXT.md` — ITransport decisions, handshake event shapes, OPER-05 invariant
- `.planning/phases/03-operator-runtime-identity-core/03-VERIFICATION.md` — what's already verified about transport

### Rotation / on-chain events the UI must render
- `.planning/phases/05-on-chain-keeperhub-workflow/05-CONTEXT.md` — rotation route shape, KeeperHub workflow nodes, event taxonomy
- `apps/operator/src/rotation/` — `/rotation/*` aggregator routes (event sources for UI)
- `apps/contract/` — FleetRegistry contract (`WalletsDeprecated` event, address recording)
- `apps/operator/data/` — deployed-address recording convention

### MCP integration point (chat event source)
- `.planning/phases/04-sonar-mcp-server/04-CONTEXT.md` — MCP tool contracts
- `apps/mcp/src/` — `list_runtimes`, `revoke`, `get_workflow_log`, and (Phase 5) `run_rotation` — chat capture hooks here

### AXL research (must produce before plan-phase emits tasks)
- (To be created in Phase 6) `.planning/phases/06-demo-ui-axl-transport/06-RESEARCH.md` — Gensyn AXL deep-dive: API surface, auth, message shapes, SDK availability, ITransport mapping, known integration friction. Strong session — this drives D-13.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/landing/src/styles/tokens.{css,ts}` — full design token set (palette, spacing, type scale). Reuse directly; consider promoting to a shared workspace if both apps need it cleanly.
- `packages/shared/transport.ts` — `ITransport` interface already defines the swap-able boundary the UI will sit behind.
- `packages/shared/messages/` — message contracts; extend here for the new `chat` log event shape.
- Operator LogBus + WS upgrade router — already broadcasts events to subscribed clients. UI is just another subscriber.
- Existing runtime client transport — model for the UI's `ITransport` client adapter (heartbeat, reconnect 1s→30s already battle-tested in Phase 4 operator/logs work).
- `../foja/apps/demo` — full reference implementation of the shell, canvas, sidebar, ambient bg, primitives. Port components and dynamics; rebrand colors to Sonar tokens; replace IssuerWallet/Agent intent with Sonar Operator/Runtime intent.

### Established Patterns
- Vite + React 18 + TypeScript across UIs (matches landing).
- `pnpm` workspace; `apps/demo-ui` already scaffolded with `@sonar/shared` dep — extend its `package.json` with `react`, `react-dom`, `framer-motion`, `vite`, `@vitejs/plugin-react` (mirror foja demo versions).
- Operator emits typed log events; UI consumes by filtering on event kind. Add `chat` kind without breaking existing consumers (MCP `get_workflow_log`, runtime).
- `concurrently` already used elsewhere — likely needed for `dev` script (operator + runtime + demo-ui together).

### Integration Points
- **MCP → Operator (new):** MCP forwards chat events to Operator LogBus. Touches `apps/mcp/src/` and Operator's log ingestion path. Requires a small server-side route or in-process publish, plus auth.
- **Operator WS → UI:** Existing WS log subscriber path; UI uses `ITransport` client adapter on the same endpoint.
- **Rotation events → Canvas:** Rotation node transitions (from Phase 5 `/rotation/*` flow) drive runtime panel state. Map event kinds to UI status pill states.
- **Chain events → Footer:** FleetRegistry `WalletsDeprecated` tx (already observable on Base Sepolia) — Footer renders the latest tx hash + explorer link. Source: Phase 5 deployment record + workflow log events.
- **Shared tokens:** If `apps/landing/src/styles/tokens.*` is imported across the workspace, evaluate promoting to `packages/ui-tokens/` (or similar) during planning. Keep tokens.test.ts contract intact.

</code_context>

<specifics>
## Specific Ideas

- "Toma mucho de `../foja/apps/demo` para un dashboard capaz — no a nivel de intención pero sí en componente y dinámica, colores los propios obviamente." (User, 2026-04-30) — Direct directive: port shell + sidebar + canvas + ambient bg + footer + motion vocabulary from foja, replace palette with Sonar tokens, replace identity-issuer intent with Sonar operator/runtime intent.
- The fourth ghost node `gamma-clone` flashing `clone-rejected` is intentionally cinematic — this is the moment that sells the project's core value on the demo video. Plan to record this event as the climax of the rotation run.
- Animated cyan edges along service ↔ runtime lines should rhyme with the landing's R3F ping/echo hero — same metaphor, same palette, different surface. Reinforces brand on the demo.
- AXL research is a deliberate up-front investment — user wants the planner armed with full Gensyn AXL information before the attempt-vs-defer call is made. Don't shortcut this with a quick web search.

</specifics>

<deferred>
## Deferred Ideas

- **Promote tokens to `packages/ui-tokens/`** — possibly worth doing if both landing and demo-ui need the same set; can be done inline in this phase or punted to a follow-up cleanup phase. Not blocking.
- **EventLog filter chips** (all / chat / handshake / on-chain) — nice-to-have UX; ship only if cheap.
- **Replay-from-fixture mode** — useful for offline rehearsal recording even though live capture is the primary source. If MCP→Operator hook hits friction, this becomes the fallback. Worth keeping as a small parallel track in planning, but not the primary path.
- **Multi-run history view** — out of demo scope.
- **Editing rotation config from the UI** — out of demo scope; demo is prompt-driven from Claude Desktop.
- **Per-runtime detail drawer with full handshake transcript** — interesting for forensics, out of demo polish budget.
- **Mainnet support / production hardening** — out of scope per PROJECT.md.

</deferred>

---

*Phase: 06-demo-ui-axl-transport*
*Context gathered: 2026-04-30*

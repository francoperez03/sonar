# Phase 6: Demo UI + AXL Transport - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 06-demo-ui-axl-transport
**Areas discussed:** Layout & visual style, Chat mirror source, Runtime panel state model, AXL transport decision

---

## Layout & Visual Style

### Q1 — Top-level layout for the demo UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Foja-style: sidebar + canvas + footer | Left sidebar (Operator controls + EventLog) + center canvas (runtime nodes) + footer. Chat as panel inside sidebar/canvas. | ✓ (Claude recommendation, accepted) |
| Three-column: chat \| runtimes \| log | Equal columns, symmetric but less cinematic. | |
| Foja shell + dedicated chat strip on top | Shell + top chat strip pinned above canvas. | |

**User's choice:** "Cual me recomendas pensa en la UX y como el usuario interactuaria" — Claude recommended foja-style and user accepted (implied via subsequent answers).
**Notes:** Reasoning given to user: runtime nodes are the visual hero (identity story); chat + log are temporal feeds that pair naturally as a stacked sidebar; footer for on-chain pulse.

### Q2 — How closely should it match the landing's cyan/blue/off-white dark theme?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse landing tokens directly | Import shared tokens from apps/landing for product coherence. | ✓ |
| Same palette, different density | Tighter spacing, ops-console feel. | |
| New ops-console palette | Diverge (terminal-green or higher contrast). | |

**User's choice:** Reuse landing tokens directly.

### Q3 — Motion / ambient layer?

| Option | Description | Selected |
|--------|-------------|----------|
| Framer-motion + ambient bg, ported from foja | Full motion vocabulary (LayoutGroup, AnimatePresence, AmbientBackground). | ✓ |
| Framer-motion only on status transitions | Motion on pills + log rows; no ambient bg. | |
| Static — CSS transitions only | Cheapest, risks looking flat. | |

**User's choice:** Framer-motion + ambient bg, ported from foja.

---

## Chat Mirror Source

### Q1 — Where do the chat messages come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Live capture via Operator log channel | MCP forwards prompt+response events to Operator LogBus; UI subscribes via existing WS. | ✓ |
| Replay scripted fixture | UI loads JSON script and replays on timer aligned to workflow events. | |
| Hybrid: live preferred, fixture fallback | Try live; fall back to fixture if hook isn't ready. | |

**User's choice:** Live capture via Operator log channel.
**Notes:** Implies new chat-typed log event; contract must be added to packages/shared/messages.

### Q2 — Chat presentation style?

| Option | Description | Selected |
|--------|-------------|----------|
| Bubble chat (user/assistant) | Familiar IM-style alternating bubbles with avatars. | ✓ |
| Terminal-style transcript | Monospace `> user:` / `< claude:`. | |
| Compact role-tagged rows | Single-line rows with role pill + truncated content. | |

**User's choice:** Bubble chat (user/assistant).

---

## Runtime Panel State Model

### Q1 — What data does each runtime node show on the canvas?

| Option | Description | Selected |
|--------|-------------|----------|
| Status pill + identity strip (recommended) | Pill + truncated pubkey 4..4 + last-event timestamp. | ✓ |
| Status pill only | Minimal, but misses identity narrative. | |
| Full card with handshake history | Pill + pubkey + handshake checklist. | |

**User's choice:** Status pill + identity strip (recommended).

### Q2 — How do clone rejection and revocation surface visually?

| Option | Description | Selected |
|--------|-------------|----------|
| Fourth ghost node `gamma-clone` | 4th node flashes red `clone-rejected` when impostor denied. | ✓ |
| Inline pulse on the legitimate node | Toast on legitimate node when clone is rejected. | |
| Banner above canvas + log highlight | Persistent banner + EventLog row highlight. | |

**User's choice:** Fourth ghost node `gamma-clone`.
**Notes:** This is the cinematic showcase moment for the demo video — clone rejection sells the core value prop.

### Q3 — Should runtime nodes connect visually to operator/keeperhub/chain services?

| Option | Description | Selected |
|--------|-------------|----------|
| Foja-style: services on canvas with animated lines | Service icons + animated cyan edge pulses during workflow. | ✓ |
| Static service badges, no edges | Show services without animated wiring. | |
| Runtimes only, services hidden | Pure runtime focus; services in EventLog only. | |

**User's choice:** Foja-style: services on canvas with animated lines.
**Notes:** Reinforces sonar ping/echo brand metaphor consistent with the landing R3F hero.

---

## AXL Transport Decision

### Q1 — AXL transport: attempt or invoke deferred-decision policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer up front, document WS as recorded fallback (recommended) | Invoke deferred-decision policy now; write `docs/decisions/axl-deferred.md`. | |
| Time-boxed AXL spike (~2h), then decide | Try an AXL adapter under ITransport with a 2h cap. | |
| Commit to AXL implementation | Build the AXL adapter as a real Phase 6 deliverable. | |
| **Other (user free-text)** | "Haz una fuerte sesion de investigacion sobre la api de AXL de gensyn para tener toda la info antes del planning" | ✓ |

**User's choice:** Run a strong, focused research session on Gensyn AXL API before planning produces the attempt-vs-spike-vs-defer decision.
**Notes:** This upgrades the default "defer-up-front" path to a research-first decision. Researcher must produce a thorough `06-RESEARCH.md` covering Gensyn AXL API surface, auth, message shapes, SDK status, ITransport mapping, and integration friction before the planner emits AXL-related tasks.

### Q2 — Does the demo UI subscribe to the operator via direct WS, or via a new client-side ITransport?

| Option | Description | Selected |
|--------|-------------|----------|
| Use ITransport client adapter (recommended) | UI uses the same client transport runtime uses; keeps swap-ability honest end-to-end. | ✓ |
| Direct WebSocket from UI | Plain `new WebSocket()`. Simpler, weakens transport-swap story. | |

**User's choice:** Use ITransport client adapter (recommended).

---

## Claude's Discretion

- Exact canvas geometry (node placement, edge curves, ambient particle density)
- Specific framer-motion easing curves and durations within foja's vocabulary
- ChatMirror auto-scroll and copy-to-clipboard UX details
- EventLog filter chips (ship only if cheap)
- Empty/idle states before the first run
- Footer layout details and explorer link styling

## Deferred Ideas

- Promote design tokens to `packages/ui-tokens/`
- EventLog filter chips
- Replay-from-fixture mode (kept as parallel fallback track)
- Multi-run history view (out of scope)
- Editing rotation config from the UI (out of scope — demo is prompt-driven)
- Per-runtime detail drawer with full handshake transcript
- Mainnet support / production hardening (out of scope)

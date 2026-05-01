---
phase: 06
plan: 05
subsystem: demo-ui canvas
tags: [canvas, runtime-node, status-pill, identity-strip, edge-pulse, framer-motion, tdd]
requirements: [DEMO-03]
dependency_graph:
  requires:
    - "@sonar/demo-ui state hooks (plan 06-03 — useRuntimes)"
    - "@sonar/demo-ui shell (plan 06-04 — App, Sidebar, Footer, useRelativeTime)"
    - "@sonar/demo-ui demo.css with landing tokens (plan 06-01 / 06-02)"
  provides:
    - "StatusPill — single source of truth for the 6 visual status states"
    - "IdentityStrip — 4..4 truncated pubkey + relative-time timestamp"
    - "RuntimeNode — full runtime card composing pill + identity-strip + ghost styling"
    - "ServiceNode — decorative chip for OPERATOR / KEEPERHUB / CHAIN"
    - "EdgePulse — animated SVG path between service and runtime"
    - "Canvas — 4 runtimes + 3 services + edge-pulse layer; the visual hero of the demo"
  affects:
    - "apps/demo-ui/src/App.tsx (canvas-slot placeholder replaced with <Canvas/>)"
    - "Phase 6 plan 06 (AXL decision + smoke verification will exercise this Canvas live)"
tech-stack:
  added: []
  patterns:
    - "AnimatePresence mode='wait' for status-pill cross-fade (UI-SPEC §Motion Contract)"
    - "framer-motion motion.path with pathLength 0->1 for cyan edge pulse (RESEARCH §Pattern 5)"
    - "SVG overlay positioned absolute behind the runtime grid; pointer-events:none"
    - "Edge-active heuristic: status in {awaiting, received} AND lastEventAt within 1500ms"
    - "@media (prefers-reduced-motion: reduce) opt-out for clone-flash keyframes + edge layer opacity floor"
    - "Module-scope RUNTIME_ORDER tuple drives both render order and edge-key generation (alpha, beta, gamma, gamma-clone)"
key-files:
  created:
    - apps/demo-ui/src/components/primitives/StatusPill.tsx
    - apps/demo-ui/src/components/primitives/IdentityStrip.tsx
    - apps/demo-ui/src/components/canvas/RuntimeNode.tsx
    - apps/demo-ui/src/components/canvas/ServiceNode.tsx
    - apps/demo-ui/src/components/canvas/EdgePulse.tsx
    - apps/demo-ui/src/components/canvas/Canvas.tsx
    - apps/demo-ui/src/test/StatusPill.test.tsx
    - apps/demo-ui/src/test/RuntimeNode.test.tsx
    - apps/demo-ui/src/test/Canvas.test.tsx
  modified:
    - apps/demo-ui/src/App.tsx
    - apps/demo-ui/src/styles/demo.css
decisions:
  - "Canvas geometry (Claude's discretion per CONTEXT): viewBox 0 0 800 480; Operator anchored at (400,60); 4 runtimes spread along y=380; cubic SVG curves from Operator to each runtime. KeeperHub/Chain are visual-only chips for now — only Operator->runtime edges pulse, since those are the ones the wire-level state messages drive."
  - "Edge-active heuristic = status in {awaiting, received} AND lastEventAt within 1500ms. UI-SPEC says 'during a workflow step' without prescribing an exact gate; this is the smallest derivation that fires on real state change without a separate event-bus."
  - "gamma-clone is visually offset 12px to the right (`translateX`) plus desaturated `filter: saturate(0.4)` + `opacity: 0.5` at idle, dropping back to full opacity/saturation when status flips to 'clone-rejected' (CONTEXT D-11 cinematic moment). The clone-flash CSS keyframes run 3x at 600ms each (UI-SPEC §Motion Contract duration.slow) and self-disable under prefers-reduced-motion."
  - "EventLog accent classifier from plan 04 stays unchanged — Canvas is the surface that consumes status_change. The reducer routes status_change to runtimes (plan 06-03), so the wire message never leaks into the events list and the canvas + sidebar are cleanly separated."
  - "RuntimeNode uses framer-motion `layout` rather than `motion.div` keyframes. Layout-only transitions are cheaper, respect reduced-motion automatically (no width/height churn here), and keep the AnimatePresence work isolated to StatusPill."
  - "Tests exercise StatusPill prop swaps via async `findByText` because AnimatePresence mode='wait' holds the exiting element until exit animation completes; jsdom resolves on the next tick."
metrics:
  duration: ~6 min
  tasks_completed: 2/2
  files_created: 9
  files_modified: 2
  test_count: 25  # 13 StatusPill + 7 RuntimeNode + 5 Canvas
  completed_date: 2026-04-30
---

# Phase 6 Plan 5: Canvas — 4 runtime nodes + 3 service nodes + edge pulses Summary

The visual hero of the demo. 4 runtime cards (`alpha`, `beta`, `gamma`, plus the cinematic ghost `gamma-clone`) reflect live state through the 6-state `StatusPill`; 3 service chips (`OPERATOR`, `KEEPERHUB`, `CHAIN`) anchor the top; an SVG overlay fires animated cyan edge pulses from Operator to each runtime when a status_change lands. DEMO-03 is satisfied end-to-end — the App now renders the full shell+canvas+footer composition.

## Goal

Land the canvas — the central surface that visualizes runtime status transitions — with all 6 status states distinct, the gamma-clone ghost destructive flash wired to `clone-rejected`, and edge pulses driven by real state from the plan-03 reducer. App.tsx loses its placeholder slot and starts rendering the live canvas.

## What Was Built

### Task 1: StatusPill + IdentityStrip + RuntimeNode primitives

- **`apps/demo-ui/src/components/primitives/StatusPill.tsx`** — accepts `status: RuntimeStatus`; wraps the lowercase label in `<AnimatePresence mode="wait">` keyed on `status` so prop changes cross-fade with `duration.base` (280ms) + `ease.standard`. Class map: `status-pill--registered|awaiting|received|deprecated|revoked|clone-rejected` per UI-SPEC §Status Pill State Map.
- **`apps/demo-ui/src/components/primitives/IdentityStrip.tsx`** — renders `${head4}…${tail4}` mono pubkey (em-dash when null) + `useRelativeTime(lastEventAt)`; timestamp is hidden until the first event lands. `data-testid="identity-strip-key"` for stable test selectors.
- **`apps/demo-ui/src/components/canvas/RuntimeNode.tsx`** — composes `<StatusPill>` + `<IdentityStrip>` + uppercase runtime name. Class chain `runtime-node runtime-node--{status} runtime-node--{id}` (+ `runtime-node--ghost` for `gamma-clone`). Uses framer-motion `layout` prop with the standard ease for board-level layout shifts; the per-status flashes ride on CSS keyframes.
- **`apps/demo-ui/src/styles/demo.css`** — appended:
  - `.status-pill` base + 6 modifier classes (transparent/dashed/filled per UI-SPEC color contract).
  - `.identity-strip` mono layout.
  - `.runtime-node` card surface with status-driven outline (dashed cyan for `awaiting`, solid cyan + `--color-accent-cyan-glow` halo for `received`, dashed muted for `deprecated`, destructive for `revoked` / `clone-rejected`).
  - `.runtime-node--ghost` desaturated/dimmed at idle, restored to full opacity when status flips to `clone-rejected`.
  - `@keyframes clone-flash` (600ms, 3 iterations) — disabled under `@media (prefers-reduced-motion: reduce)`.

### Task 2: ServiceNode + EdgePulse + Canvas + App wiring

- **`apps/demo-ui/src/components/canvas/ServiceNode.tsx`** — three labelled chips (`KEEPERHUB`, `OPERATOR`, `CHAIN`); `role="group"` + `aria-label`; non-interactive.
- **`apps/demo-ui/src/components/canvas/EdgePulse.tsx`** — `<AnimatePresence>` wrapping a `<motion.path>` with `pathLength: 0→1` and `opacity: [0, 1, 0]` envelope, `duration.slow` (600ms) + `ease.emphasized` (cubic-bezier(0.16,1,0.3,1)).
- **`apps/demo-ui/src/components/canvas/Canvas.tsx`** — composition layer:
  - Reads `useRuntimes()`; iterates `RUNTIME_ORDER = ['alpha','beta','gamma','gamma-clone']`.
  - Top row: 3 `<ServiceNode>`s.
  - Middle layer: `<svg viewBox="0 0 800 480">` overlay with 4 `<EdgePulse>`s, one per `operator-{rid}` path; `active` derivation = `(status === 'awaiting' || status === 'received') && lastEventAt within 1500ms`.
  - Bottom row: 4 `<RuntimeNode>`s in CSS grid (`grid-template-columns: repeat(4, 1fr)`).
  - Idle hint copy `Standing by — 3 runtimes registered, clone candidate at the edge.` shown when ALL runtimes are still `registered`.
- **`apps/demo-ui/src/App.tsx`** — `canvas-slot` placeholder removed; `<Canvas />` rendered in its place.
- **`apps/demo-ui/src/styles/demo.css`** — appended `.demo-canvas`, `.demo-canvas-services`, `.service-node`, `.demo-canvas-edges` (absolute SVG overlay), `.demo-canvas-runtimes` (4-col grid + gamma-clone offset), `.demo-canvas-idle` copy, prefers-reduced-motion edge-layer opacity floor.

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @sonar/demo-ui test:run` | **67/67** (13 StatusPill + 7 RuntimeNode + 5 Canvas + 17 reducer + 7 transport + 5 store + 4 ChatMirror + 4 EventLog + 3 Footer + 2 smoke) |
| `pnpm --filter @sonar/demo-ui typecheck` | green |
| `pnpm --filter @sonar/demo-ui build` | green (378.52 kB / 118.13 kB gz; 8.71 kB CSS / 2.24 kB gz) |
| `grep -q "clone-rejected" apps/demo-ui/src/components/primitives/StatusPill.tsx` | ok |
| `grep -q "ghost" apps/demo-ui/src/components/canvas/RuntimeNode.tsx` | ok |
| `grep -q "prefers-reduced-motion" apps/demo-ui/src/styles/demo.css` | ok |
| `grep -q "OPERATOR" apps/demo-ui/src/components/canvas/ServiceNode.tsx` | ok |
| `grep -q "pathLength" apps/demo-ui/src/components/canvas/EdgePulse.tsx` | ok |
| `grep -q "gamma-clone" apps/demo-ui/src/components/canvas/Canvas.tsx` | ok |
| `grep -q "Standing by" apps/demo-ui/src/components/canvas/Canvas.tsx` | ok |
| `grep -q "<Canvas />" apps/demo-ui/src/App.tsx` | ok |

### Key tests

**StatusPill (13)** — every status renders verbatim lowercase label as text; every status applies its `status-pill--<status>` class; rerender from `registered` → `awaiting` settles to the new label after AnimatePresence exit (uses async `findByText`).

**RuntimeNode (7)** — uppercase name renders for all 4 runtime ids; StatusPill child renders status text; 64-char pubkey truncated as `abcd…z123`; `null` pubkey renders `—`; `runtime-node--clone-rejected` class present when gamma-clone has clone-rejected status; `runtime-node--ghost` class present at idle.

**Canvas (5)** — 4 `runtime-node-{id}` testids present; 3 service labels (`OPERATOR`, `KEEPERHUB`, `CHAIN`) present; idle hint copy visible at startup; `store.receive(status_change alpha->awaiting)` updates alpha node class to contain `awaiting` AND removes the idle hint; `store.receive(log_entry "Clone rejected: …")` flips gamma-clone node class to contain `clone-rejected`.

## Deviations from Plan

None requiring user attention. Two minor pragmatic interpretations:

1. **StatusPill rerender test uses async `findByText` instead of synchronous `getByText`.** The plan acknowledged "AnimatePresence may briefly hold both during transition; assert eventual." `findByText` is testing-library's idiomatic primitive for "eventually" — synchronous `getByText` raced AnimatePresence's exit cycle in jsdom. No production-code impact; the assertion semantics match the plan's intent.

2. **Canvas only wires Operator→runtime edges (not KeeperHub→ or Chain→).** The plan's `PATHS` map listed an example `keeperhub-alpha` and `chain-gamma` path but no derivation from state. Since the wire-level `status_change` messages flow Operator→runtime, only those edges have an active source — KeeperHub/Chain edges would always be `false` and add SVG noise without UX value. Documented in Canvas.tsx; future plans can layer additional edge sources (KeeperHub workflow events, on-chain `WalletsDeprecated`) when those events become canvas-visible.

### Auto-fixed Issues

None — both tasks executed as written. No bugs surfaced; no auth gates; no architectural changes.

### Out-of-Scope Items (not fixed — pre-existing)

- `apps/operator/apps/` and `.claude/` directories present as untracked at start; left alone (not produced by this plan).
- Pre-existing `apps/landing` jest-dom Assertion type errors (documented in 06-01-SUMMARY.md §1) untouched.

## Authentication Gates

None. Plan is fully offline (jsdom + framer-motion + react-virtuoso; no live transport, no chain calls, no MCP round-trip).

## TDD Gate Compliance

Both tasks declared `tdd="true"`. Per the plan-level type `execute` (not `tdd`), per-task atomic commits bundle RED+GREEN — matching the precedent set by plan 06-03.

- **Task 1:** RED (StatusPill.test.tsx + RuntimeNode.test.tsx unable to resolve missing component imports) → GREEN (StatusPill + IdentityStrip + RuntimeNode + CSS, 20/20 specs pass). Single commit `5030c43`.
- **Task 2:** RED (Canvas.test.tsx unable to resolve `../components/canvas/Canvas.js`) → GREEN (ServiceNode + EdgePulse + Canvas + App wiring, 5/5 specs pass; full suite 67/67). Single commit `6f39e83`.

No REFACTOR pass needed — implementations went green on first iteration.

## Threat Compliance

- **T-06-18 (T, runtime.id in className):** mitigated. `RuntimeId` is a TS string-literal union; reducer's `isRuntimeId` guard rejects unknown ids; `RUNTIME_ORDER` is a fixed module-scope tuple. No untrusted id can reach Canvas → RuntimeNode className.
- **T-06-19 (D, AnimatePresence churn):** mitigated. Reducer's `ALLOWED` transition table (plan 06-03) makes `received`/`deprecated`/`revoked`/`clone-rejected` terminal — oscillation is impossible at the data layer. RESEARCH Pitfall 5 avoided: `LayoutGroup` is not used at the runtime-node level; `layout` lives only on `<motion.div>` per node.
- **T-06-20 (I, pubkey disclosure):** accepted. UI shows only `4..4` truncation; full pubkey is never rendered in this plan.

## Known Stubs

None. The canvas data-plane is fully wired through `useRuntimes()`; every visual state is reachable from a wire-level `Message`. KeeperHub/Chain edges are deliberately decorative for now (see Deviation #2 above), not stubs.

## Threat Flags

None — no new network surface, no new auth path, no schema changes at trust boundaries. The reducer regex bridge (`/^Clone rejected:/`, `WalletsDeprecated`) was introduced in plan 06-03 and is unchanged here.

## Files Created / Modified

**Created (9):**

- apps/demo-ui/src/components/primitives/StatusPill.tsx
- apps/demo-ui/src/components/primitives/IdentityStrip.tsx
- apps/demo-ui/src/components/canvas/RuntimeNode.tsx
- apps/demo-ui/src/components/canvas/ServiceNode.tsx
- apps/demo-ui/src/components/canvas/EdgePulse.tsx
- apps/demo-ui/src/components/canvas/Canvas.tsx
- apps/demo-ui/src/test/StatusPill.test.tsx
- apps/demo-ui/src/test/RuntimeNode.test.tsx
- apps/demo-ui/src/test/Canvas.test.tsx

**Modified (2):**

- apps/demo-ui/src/App.tsx
- apps/demo-ui/src/styles/demo.css

## Commits

| Task | Hash    | Message                                                                          |
| ---- | ------- | -------------------------------------------------------------------------------- |
| 1    | 5030c43 | feat(06-05): StatusPill + IdentityStrip + RuntimeNode primitives (TDD)           |
| 2    | 6f39e83 | feat(06-05): Canvas + ServiceNode + EdgePulse + App wiring (TDD)                 |

## Self-Check: PASSED

Files exist:

- apps/demo-ui/src/components/primitives/StatusPill.tsx → FOUND
- apps/demo-ui/src/components/primitives/IdentityStrip.tsx → FOUND
- apps/demo-ui/src/components/canvas/RuntimeNode.tsx → FOUND
- apps/demo-ui/src/components/canvas/ServiceNode.tsx → FOUND
- apps/demo-ui/src/components/canvas/EdgePulse.tsx → FOUND
- apps/demo-ui/src/components/canvas/Canvas.tsx → FOUND
- apps/demo-ui/src/test/StatusPill.test.tsx → FOUND
- apps/demo-ui/src/test/RuntimeNode.test.tsx → FOUND
- apps/demo-ui/src/test/Canvas.test.tsx → FOUND

Commits exist:

- 5030c43 → FOUND
- 6f39e83 → FOUND

Test suite: 67/67 green; typecheck green; build green.

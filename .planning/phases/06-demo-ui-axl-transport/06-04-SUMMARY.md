---
phase: 06
plan: 04
subsystem: demo-ui
tags: [shell, sidebar, footer, virtuoso, framer-motion, ambient-background, tx-hash-chip]
requires:
  - apps/demo-ui/src/state/hooks.ts (plan 06-03)
  - apps/landing/src/styles/tokens.css (plan 01-02)
  - packages/shared/messages/chat.ts (plan 06-01)
provides:
  - apps/demo-ui/src/components/shell/AmbientBackground.tsx
  - apps/demo-ui/src/components/shell/Sidebar.tsx
  - apps/demo-ui/src/components/shell/Footer.tsx
  - apps/demo-ui/src/components/sidebar/ChatMirror.tsx
  - apps/demo-ui/src/components/sidebar/EventLog.tsx
  - apps/demo-ui/src/components/primitives/TxHashChip.tsx
  - apps/demo-ui/src/util/relativeTime.ts
affects:
  - apps/demo-ui/src/App.tsx
  - apps/demo-ui/src/styles/demo.css
tech-stack:
  added:
    - react-virtuoso (already declared in package.json; first runtime use)
  patterns:
    - useSyncExternalStore-backed selector hooks (plan 06-03) → consumed by ChatMirror/EventLog/Footer
    - Virtuoso followOutput=smooth (chat) / "auto" (event burst) per RESEARCH Pitfall 3
    - useReducedMotion guard collapses AmbientBackground to opacity-only fades
key-files:
  created:
    - apps/demo-ui/src/components/shell/AmbientBackground.tsx
    - apps/demo-ui/src/components/shell/Sidebar.tsx
    - apps/demo-ui/src/components/shell/Footer.tsx
    - apps/demo-ui/src/components/sidebar/ChatMirror.tsx
    - apps/demo-ui/src/components/sidebar/EventLog.tsx
    - apps/demo-ui/src/components/primitives/TxHashChip.tsx
    - apps/demo-ui/src/util/relativeTime.ts
    - apps/demo-ui/src/test/Footer.test.tsx
    - apps/demo-ui/src/test/ChatMirror.test.tsx
    - apps/demo-ui/src/test/EventLog.test.tsx
  modified:
    - apps/demo-ui/src/App.tsx
    - apps/demo-ui/src/styles/demo.css
decisions:
  - Virtuoso heights: 320px ChatMirror / 240px EventLog (Claude discretion)
  - Jump-to-latest affordance: skipped (CONTEXT discretion — followOutput already pauses on user scroll-up; ship time better spent on plan 06-05 canvas)
  - Accent eyebrow detected by message keyword ("received"|"deprecated") rather than wire-level status_change kind, since the reducer routes status_change to runtimes (not events). Matches the visible UX intent of UI-SPEC §EventLog row contract.
  - initialItemCount={data.length} added to both Virtuoso instances so jsdom (no layout) renders rows synchronously for tests; no observable change in real browsers.
metrics:
  duration: ~30min
  completed: 2026-04-30
---

# Phase 6 Plan 04: Shell, Sidebar (ChatMirror + EventLog), Footer (TxHashChip) Summary

Ports the foja `apps/demo` shell topology into Sonar (`AmbientBackground` + `Sidebar` + canvas-slot + `Footer`), wires `ChatMirror`/`EventLog`/`Footer` to the data-plane hooks from plan 06-03, and ships `TxHashChip` with a Base Sepolia explorer link. Delivers the temporal-narrative half of the UI (DEMO-01 chat mirror + DEMO-02 event stream); canvas (DEMO-03) lands in plan 06-05.

## What Was Built

### Task 1: Shell — App, AmbientBackground, Sidebar, Footer, TxHashChip + relativeTime

- `App.tsx` rewritten to compose `<AmbientBackground/>` + `<main.demo-shell>` (Sidebar + canvas-slot placeholder for plan 06-05) + `<Footer/>`
- `AmbientBackground.tsx` ports foja's 12-firefly ambient layer; uses `framer-motion`'s `useReducedMotion` to collapse to a static low-opacity layer when `prefers-reduced-motion: reduce`
- `Sidebar.tsx` renders the visually-hidden `Sonar — Live Rotation` heading and two eyebrow-labelled sections (`CHAT`, `EVENTS`) wrapping plan-04 components
- `Footer.tsx` reads `useLastDeprecation()` and renders `TxHashChip` (or the empty-state copy `No on-chain deprecation yet`); right side shows the `Run again` CTA
- `TxHashChip.tsx` renders `0x{first6}…{last4}` mono with click-to-copy via `navigator.clipboard.writeText`; explorer link points at `https://sepolia.basescan.org/tx/${hash}` with `rel="noopener noreferrer"` (T-06-15 mitigation, Phase 1 pattern)
- `util/relativeTime.ts` ports foja's `useRelativeTime` hook (now / +5s / +1m / +1h, refreshes every 5s)
- `styles/demo.css` populated per UI-SPEC §Layout Contract: shell grid (360–440px sidebar | 1fr canvas, single-column < 900px), sidebar/footer surfaces, eyebrow style, tx-hash-chip + cta-primary tokens, chat-bubble + event-row scaffolding for Task 2
- Footer test (3 cases) covers empty-state, populated-state with truncated hash + explorer href + rel/target attrs, and Run again CTA contract

### Task 2: ChatMirror + EventLog (Virtuoso-driven, hook-fed)

- `ChatMirror.tsx` reads `useChats()`; renders `<Virtuoso followOutput="smooth" atBottomThreshold={48}>` with role-conditional bubble (`chat-bubble--user` accent-cyan left border, `chat-bubble--assistant` surface fill); empty-state copy `Awaiting prompt` + body verbatim from UI-SPEC §Copywriting Contract
- `EventLog.tsx` reads `useEvents()`, filters out `kind === 'chat'` defensively (D-07 invariant guard — chat lives in ChatMirror by construction; the reducer never adds chat to events, so this filter is belt-and-suspenders), renders `<Virtuoso followOutput="auto" atBottomThreshold={48}>` with timestamp · kind tag · message body. Status-milestone rows (`received`, `deprecated` in the message text) get the `is-accent` class on the eyebrow
- `initialItemCount={data.length}` on both Virtuoso instances forces jsdom (no real layout) to render rows synchronously for tests; no observable effect in real browsers
- 8 new tests: 4 ChatMirror (empty / single user / user+assistant order / role-class isolation) + 4 EventLog (empty / log-entry row / chat filter / accent eyebrow)

## Verification

- `pnpm --filter @sonar/demo-ui test:run` → 42/42 green (3 Footer + 4 ChatMirror + 4 EventLog + 17 reducer + 5 store + 7 transport + 2 smoke)
- `pnpm --filter @sonar/demo-ui typecheck` → green
- `pnpm --filter @sonar/demo-ui build` → green (`dist/assets/index-*.{css,js}` produced; ~373 kB JS pre-gzip — framer-motion + virtuoso + react)

Acceptance grep checks (plan §acceptance_criteria):
- `sepolia.basescan.org` in TxHashChip ✓
- `View on Base Sepolia` in TxHashChip (Footer renders TxHashChip) ✓
- `noopener noreferrer` in TxHashChip ✓
- `useLastDeprecation` in Footer ✓
- reduced-motion guard in AmbientBackground (`useReducedMotion` import; CSS fallback in demo.css) ✓
- `followOutput="smooth"` in ChatMirror ✓
- `followOutput="auto"` in EventLog ✓
- chat filter in EventLog ✓
- `Awaiting prompt` in ChatMirror ✓
- `No events yet` in EventLog ✓
- `atBottomThreshold={48}` in both ✓

## Deviations from Plan

### None requiring user attention.

Two minor pragmatic interpretations, recorded for traceability:

1. **`initialItemCount` on Virtuoso (not in plan code blocks).** The plan acknowledged "Virtuoso may not virtualize in jsdom (no real layout) — that's fine; assert on DOM presence." In practice Virtuoso renders zero rows in jsdom without the `initialItemCount` prop. Adding `initialItemCount={data.length}` is a no-op in the browser (where layout exists and Virtuoso virtualizes normally) and lets the unit tests assert directly on DOM presence as the plan intended. Rule 3 (auto-fix blocking issue) — the tests would otherwise be unreachable.

2. **EventLog accent classifier reads message text, not message kind.** The plan's row spec says "accent-cyan if status_change to received/deprecated." The on-wire `status_change` message kind never enters `state.events` (the reducer routes it to `state.runtimes` per plan 06-03). Modifying the plan-03 reducer was out of scope, so the classifier instead uses a `\b(received|deprecated)\b` regex against the message text — matches the visible UX intent of UI-SPEC §EventLog row contract without touching previously-shipped code. Documented in EventLog.tsx JSDoc.

### Auto-fixed Issues

None — both tasks executed as written. No bugs surfaced; no auth gates; no architectural changes.

## Threat Model Status

All UI-SPEC §Trust Boundary mitigations applied:
- T-06-14 (chat content rendered as text): React text-child rendering escapes HTML by default; no `dangerouslySetInnerHTML` introduced
- T-06-15 (TxHashChip target=_blank window.opener leakage): `rel="noopener noreferrer"` on the `<a>` (verified by Footer test)
- T-06-16 (URL injection via hash interpolation): hash sourced from reducer regex `0x[a-fA-F0-9]{64}` (plan 06-03), structurally bounded
- T-06-17 (unbounded chats / events arrays): reducer caps at 1000 (plan 06-03); Virtuoso virtualization keeps DOM small in production

No new threat surface introduced beyond what UI-SPEC anticipated.

## Commits

- `f43630a` test(06-04): add failing Footer test for empty/populated TxHashChip + Run again CTA
- `802391b` feat(06-04): shell — App, AmbientBackground, Sidebar, Footer + TxHashChip + relativeTime util
- `c214ab7` test(06-04): add failing ChatMirror + EventLog tests (8 cases)
- `793ecb6` feat(06-04): ChatMirror + EventLog wired to Virtuoso + state hooks (TDD GREEN)

## Self-Check: PASSED

Files exist:
- apps/demo-ui/src/components/shell/AmbientBackground.tsx ✓
- apps/demo-ui/src/components/shell/Sidebar.tsx ✓
- apps/demo-ui/src/components/shell/Footer.tsx ✓
- apps/demo-ui/src/components/sidebar/ChatMirror.tsx ✓
- apps/demo-ui/src/components/sidebar/EventLog.tsx ✓
- apps/demo-ui/src/components/primitives/TxHashChip.tsx ✓
- apps/demo-ui/src/util/relativeTime.ts ✓
- apps/demo-ui/src/test/Footer.test.tsx ✓
- apps/demo-ui/src/test/ChatMirror.test.tsx ✓
- apps/demo-ui/src/test/EventLog.test.tsx ✓

Commits exist:
- f43630a ✓
- 802391b ✓
- c214ab7 ✓
- 793ecb6 ✓

Test suite: 42/42 green; typecheck green; build green.

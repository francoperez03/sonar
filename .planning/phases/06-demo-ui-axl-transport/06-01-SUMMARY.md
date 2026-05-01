---
phase: 06
plan: 01
subsystem: demo-ui + shared-messages
tags: [scaffold, vite, vitest, react, shared-messages, chat-msg]
requires:
  - "@sonar/shared discriminated Message union (existing)"
  - "@sonar/landing tokens.css (existing — Phase 1)"
provides:
  - "@sonar/demo-ui buildable Vite+React 18 app on port 5174"
  - "@sonar/demo-ui Vitest harness (jsdom + jest-dom matchers)"
  - "ChatMsg shape exported as a Message discriminated-union member"
  - "shared package test:run script (vitest 2.1)"
affects:
  - packages/shared (new chat schema + vitest infra)
  - apps/demo-ui (full scaffold; was placeholder package.json + stub index.ts)
tech-stack:
  added:
    - "react@^18.3.1 + react-dom@^18.3.1 (demo-ui)"
    - "framer-motion@^11.11.0 (matches landing pin per CONTEXT D-06)"
    - "react-virtuoso@^4.18.6 (autoscrolling feed primitive for plans 04/06)"
    - "vite@^5.4.10 + @vitejs/plugin-react@^4.7.0 (demo-ui)"
    - "vitest@^2.1.0 + jsdom@^25 + @testing-library/{react,jest-dom} (demo-ui)"
    - "@vitest/expect@^2.1.0 (devDep — pulls @vitest/expect into demo-ui scope so the jest-dom Assertion augmentation actually applies)"
    - "vitest@^2.1.0 added to packages/shared so chat schema tests run"
  patterns:
    - "Re-export design tokens from landing via CSS @import (per CONTEXT D-05; promotion to packages/ui-tokens deferred)"
    - "Module-scope React root mount (no inline WebSocket — RESEARCH Pitfall 1)"
    - "Explicit expect.extend(matchers) instead of jest-dom/vitest auto-binding (works around vitest 2/4 hoisting collision)"
    - "Local jest-dom.d.ts augments both `vitest` and `@vitest/expect` Assertion interfaces"
key-files:
  created:
    - packages/shared/src/messages/chat.ts
    - packages/shared/src/messages/chat.test.ts
    - apps/demo-ui/index.html
    - apps/demo-ui/vite.config.ts
    - apps/demo-ui/vitest.config.ts
    - apps/demo-ui/src/App.tsx
    - apps/demo-ui/src/main.tsx
    - apps/demo-ui/src/styles/tokens.css
    - apps/demo-ui/src/styles/demo.css
    - apps/demo-ui/src/test/setup.ts
    - apps/demo-ui/src/test/smoke.test.tsx
    - apps/demo-ui/src/test/jest-dom.d.ts
  modified:
    - packages/shared/src/messages/index.ts (append ChatMsg to discriminatedUnion + barrel)
    - packages/shared/package.json (vitest devDep + test scripts)
    - packages/shared/tsconfig.json (exclude *.test.ts from tsc build)
    - apps/demo-ui/package.json (full stack pin)
    - apps/demo-ui/tsconfig.json (DOM lib, jsx react-jsx, types)
    - pnpm-lock.yaml
  deleted:
    - apps/demo-ui/src/index.ts (placeholder stub from Phase 2; replaced by main.tsx)
decisions:
  - "Pin framer-motion@^11.11.0 (not ^12.x as RESEARCH initially recommended) — matches apps/landing for cross-app consistency; v11 carries all foja-port APIs (LayoutGroup, AnimatePresence, motion.path pathLength). v12 migration deferred to a post-demo cleanup phase."
  - "Tokens consumed via CSS @import from apps/landing; promotion to packages/ui-tokens deferred per CONTEXT D-05."
  - "Singleton ITransport boot deferred to plan 03 — main.tsx mounts <App /> only; never inlines `new WebSocket()` (RESEARCH Pitfall 1)."
  - "Use explicit expect.extend(matchers) + local Assertion augmentation; the @testing-library/jest-dom/vitest auto-binding fights the workspace's mixed vitest@2/4 install topology."
  - "Add @vitest/expect as a demo-ui devDep so tsc can resolve the module from inside this app's local jest-dom.d.ts and apply the type augmentation."
  - "Add vitest@^2.1.0 to @sonar/shared so the new chat.test.ts has a real runner without bumping shared into the vitest@4 cluster (operator/runtime/mcp/keeperhub) — alignment with landing."
metrics:
  duration: ~25 min
  tasks_completed: 2
  files_created: 12
  files_modified: 6
  files_deleted: 1
  test_count: 7  # 5 chat schema + 2 demo-ui smoke
  completed_date: 2026-04-30
---

# Phase 6 Plan 1: demo-ui scaffold (Vite + React 18 + Vitest + shared chat messages) Summary

Wave 0 scaffold for `@sonar/demo-ui` and the shared `ChatMsg` contract — lands a buildable, typed, test-running React/Vite app and adds chat messages to the shared discriminated `Message` union so MCP, Operator, and UI all parse the same shape (per CONTEXT D-09 / RESEARCH Pitfall 7). Plans 02–06 now have a working test+typecheck loop to develop against.

## Goal

Land the smallest functional demo-ui scaffold (empty themed shell, smoke tests green, typecheck/build clean) plus the shared chat-message schema, **without** introducing the transport, components, or AXL work owned by later plans in this phase.

## What Was Built

- **`packages/shared/src/messages/chat.ts`** — zod schema with `type='chat'`, `role: user|assistant`, `content: string().min(1)`, `timestamp: number`. Mirrors `log.ts` analog from PATTERNS.
- **`packages/shared/src/messages/index.ts`** — append `ChatMsg` to `Message = z.discriminatedUnion('type', [...])` and barrel-export.
- **`packages/shared/src/messages/chat.test.ts`** — 5 vitest specs (round-trip user, round-trip assistant, accepted by union, reject `system` role, reject empty content).
- **`packages/shared/package.json` + `tsconfig.json`** — add vitest@^2.1.0 + `test` / `test:run` scripts; exclude `*.test.ts` from `tsc` build so dist stays clean.
- **`apps/demo-ui/`** — full scaffold:
  - `package.json` pinned to React 18.3, framer-motion 11.11, react-virtuoso 4.18, vite 5.4, vitest 2.1, @vitest/expect 2.1, jsdom 25, @testing-library/{react@16, jest-dom@6}.
  - `vite.config.ts` — dev port 5174 / preview port 4174 (avoid clash with landing 5173/4173).
  - `vitest.config.ts` — jsdom env, setupFiles, `react() as unknown as never` cast (vite7/vitest2 plugin-type skew, mirrors landing).
  - `tsconfig.json` — ESNext + Bundler resolution, `jsx: react-jsx`, DOM libs, `types: ["vite/client", "@testing-library/jest-dom/vitest"]`.
  - `index.html` — minimal `<!doctype>` with `data-theme="dark"`, `<title>Sonar — Live Rotation</title>`.
  - `src/main.tsx` — StrictMode root mount; imports `tokens.css` + `demo.css`. Singleton transport boot deliberately deferred to plan 03.
  - `src/App.tsx` — empty themed `<main data-testid="demo-ui-root">` shell with visually-hidden h1 — populated by plans 04/05.
  - `src/styles/tokens.css` — single-line `@import` of `apps/landing/src/styles/tokens.css` (no fork; CONTEXT D-05).
  - `src/styles/demo.css` — body theming using `var(--color-bg)` / `var(--color-text)` so the empty shell renders in Sonar palette.
  - `src/test/setup.ts` — IntersectionObserver + matchMedia + ResizeObserver stubs; explicit `expect.extend(matchers)` (see Deviations §1).
  - `src/test/jest-dom.d.ts` — local module augmentation so tsc sees jest-dom matchers on `Assertion<T>` (see Deviations §1).
  - `src/test/smoke.test.tsx` — renders App, asserts root container present, dynamically imports `@sonar/shared` and asserts `Message` exported.
  - delete `src/index.ts` placeholder (the Phase 2 stub).

## Verification

- `pnpm --filter @sonar/shared test:run` — **5/5 green** (chat schema specs).
- `pnpm --filter @sonar/shared typecheck` + `build` — **green**.
- `pnpm --filter @sonar/demo-ui test:run` — **2/2 green** (smoke + shared import).
- `pnpm --filter @sonar/demo-ui typecheck` — **green**.
- `pnpm --filter @sonar/demo-ui build` — **green** (vite build emits 142 kB / 45.85 kB gz; CSS 1.56 kB).
- `pnpm -r --filter '!@sonar/landing' typecheck` — **green** across operator/runtime/mcp/keeperhub/shared/demo-ui (7 packages).
- Acceptance grep checks all pass: `react-virtuoso`, `framer-motion`, port `5174`, `ResizeObserver` stub, no inline `new WebSocket` in main.tsx/App.tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] jest-dom matchers fail to bind under workspace's mixed vitest@2/4 install**

- **Found during:** Task 2 (smoke test).
- **Issue:** `expect(...).toBeInTheDocument()` failed both at runtime (`Invalid Chai property`) and at typecheck (`Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'`). Root cause: workspace ships two parallel vitest installs (vitest@2.1 in landing/demo-ui, vitest@4.1.5 pinned exactly in operator/runtime/mcp/keeperhub). pnpm hoists vitest@4 to the root `node_modules`. The `@testing-library/jest-dom/vitest` auto-binding then (a) calls `expect.extend` against the hoisted v4 instance — wrong runner — and (b) augments vitest@4's `Assertion` for tsc, leaving the v2 runtime path with neither matchers nor types.
- **Fix:** (a) Replace `import "@testing-library/jest-dom/vitest"` in `src/test/setup.ts` with `import { expect } from "vitest"; import * as matchers from "@testing-library/jest-dom/matchers"; expect.extend(matchers);` so binding lands on the local vitest. (b) Ship `src/test/jest-dom.d.ts` re-augmenting both `vitest` and `@vitest/expect` `Assertion` interfaces. (c) Add `@vitest/expect@^2.1.0` to demo-ui devDeps so the augmentation actually resolves the module from this app's scope. Documented inline with comments in setup.ts and jest-dom.d.ts.
- **Files modified:** apps/demo-ui/src/test/setup.ts, apps/demo-ui/src/test/jest-dom.d.ts (new), apps/demo-ui/package.json, apps/demo-ui/tsconfig.json.
- **Commit:** b423e62.

**2. [Rule 3 — Blocking] @sonar/shared has no test runner; plan acceptance requires `test:run` to exist**

- **Found during:** Task 1 acceptance criterion `pnpm --filter @sonar/shared test:run`.
- **Issue:** Pre-Phase-6 `packages/shared/package.json` exposed only `build`, `typecheck`, `clean` — no test runner, so the chat schema specs had nowhere to run.
- **Fix:** Add `vitest@^2.1.0` devDep + `"test"` and `"test:run": "vitest run --passWithNoTests"` scripts. Also add `"src/**/*.test.ts"` to `tsconfig.json` `exclude` so `tsc` (the package's `build`) does not emit `*.test.{js,d.ts}` into `dist`. Vitest version aligned with landing's ^2.1.0 instead of operator's pinned 4.1.5 to keep shared's transitive deps with the chai/expect cluster used by demo-ui (avoids re-introducing the same version-skew that fix #1 had to absorb).
- **Files modified:** packages/shared/package.json, packages/shared/tsconfig.json.
- **Commit:** 415fc99.

**3. [Rule 3 — Blocking] `apps/demo-ui/src/index.ts` Phase-2 placeholder collides with the new entrypoint**

- **Found during:** Task 2.
- **Issue:** Phase 2 had committed an `index.ts` stub (`// Stub — real implementation in Phase 6.`) at `apps/demo-ui/src/`. The plan task created `src/main.tsx` as the real entry, but the stub remained as dead code referencing `console.log` at module scope.
- **Fix:** `git rm apps/demo-ui/src/index.ts` as part of Task 2's commit. Phase 2 D-decisions (STATE.md plan 02-03) explicitly anticipated this replacement.
- **Files modified:** delete apps/demo-ui/src/index.ts.
- **Commit:** b423e62.

### Out-of-Scope Items (not fixed — pre-existing)

- **`apps/landing` test suite** fails 6 specs (Invalid Chai property: `toBeInTheDocument` / `toHaveAttribute` / `toBeDisabled`) and `pnpm --filter @sonar/landing typecheck` reports the same Assertion errors. **Pre-existing** on the worktree base commit `0ead9b4b`; same root cause as Deviation #1 but lives in landing where this plan does not modify any files. Tracked for a future cleanup pass — landing should adopt the same `expect.extend(matchers)` + local `jest-dom.d.ts` pattern this plan introduced for demo-ui. **Not added to deferred-items.md** because no `phase_dir/deferred-items.md` was found pre-existing and the orchestrator owns that ledger.

## Authentication Gates

None. This plan is fully offline (no chain calls, no live transport, no MCP round-trip).

## Files Created / Modified

**Created (12):**

- packages/shared/src/messages/chat.ts
- packages/shared/src/messages/chat.test.ts
- apps/demo-ui/index.html
- apps/demo-ui/vite.config.ts
- apps/demo-ui/vitest.config.ts
- apps/demo-ui/src/App.tsx
- apps/demo-ui/src/main.tsx
- apps/demo-ui/src/styles/tokens.css
- apps/demo-ui/src/styles/demo.css
- apps/demo-ui/src/test/setup.ts
- apps/demo-ui/src/test/smoke.test.tsx
- apps/demo-ui/src/test/jest-dom.d.ts

**Modified (6):**

- packages/shared/src/messages/index.ts
- packages/shared/package.json
- packages/shared/tsconfig.json
- apps/demo-ui/package.json
- apps/demo-ui/tsconfig.json
- pnpm-lock.yaml

**Deleted (1):**

- apps/demo-ui/src/index.ts

## Commits

| Task | Hash    | Message                                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------------------- |
| 1    | 415fc99 | feat(06-01): add ChatMsg to @sonar/shared discriminated Message union                    |
| 2    | b423e62 | feat(06-01): scaffold @sonar/demo-ui — Vite 5 + React 18 + Vitest harness                |

## Threat Flags

None — no new security-relevant surface introduced. The plan's threat register (T-06-01..03) is mitigated by zod's discriminated-union parsing (covered by chat.test.ts negative cases) and accepted for content length / static bundle disclosure per the plan's existing dispositions.

## Self-Check: PASSED

Verification:

- `[ -f packages/shared/src/messages/chat.ts ]` → FOUND
- `[ -f packages/shared/src/messages/chat.test.ts ]` → FOUND
- `[ -f apps/demo-ui/vite.config.ts ]` → FOUND
- `[ -f apps/demo-ui/vitest.config.ts ]` → FOUND
- `[ -f apps/demo-ui/src/main.tsx ]` → FOUND
- `[ -f apps/demo-ui/src/App.tsx ]` → FOUND
- `[ -f apps/demo-ui/src/styles/tokens.css ]` → FOUND
- `[ -f apps/demo-ui/src/test/setup.ts ]` → FOUND
- `[ -f apps/demo-ui/src/test/smoke.test.tsx ]` → FOUND
- `[ -f apps/demo-ui/src/test/jest-dom.d.ts ]` → FOUND
- `[ ! -f apps/demo-ui/src/index.ts ]` → REMOVED
- `git log --oneline | grep 415fc99` → FOUND
- `git log --oneline | grep b423e62` → FOUND

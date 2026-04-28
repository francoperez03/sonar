---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-04-28T02:55:00Z"
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 12
  completed_plans: 8
  percent: 67
---

# State: Sonar

## Project Reference

- **Core Value**: A clone of a runtime's binary cannot intercept rotated credentials — identity is verified cryptographically (Ed25519) at the last mile, and the LLM never sees the private key by construction.
- **Current Focus**: ETHGlobal OpenAgents submission, track *Best Use of KeeperHub*, deadline 2026-05-03.
- **Mode**: yolo
- **Granularity**: standard
- **Parallelization**: enabled

## Current Position

Phase: 03 (operator-runtime-identity-core) — EXECUTING
Plan: 4 of 5

- **Phase**: 01-public-landing (4/4 plans complete — DONE) || 02-workspace-foundation (complete) || 03-operator-runtime-identity-core (3/5 plans complete)
- **Plan**: Phase 1 closed; Phase 3 — 3/5 complete (03-01 Wave 0, 03-02 Operator core, 03-03 HTTP control plane)
- **Status**: Plan 01-04 executed — Local LHCI 3/3 green (LCP median 676ms), Vercel-preview LHCI 3/3 green (LCP median 395ms), LCP element attribution proven = h1, axe-core a11y green. Phase 1 (Public Landing) DONE.
- **Progress**: 2/7 phases complete

```
[██░░░░░] 2/7
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 7 |
| Phases complete | 2 |
| v1 Requirements mapped | 40/40 |
| Plans complete | 8 |
| Days to deadline | 5 (as of 2026-04-28) |

## Accumulated Context

### Key Decisions (from PROJECT.md)

- Ed25519 challenge/response (not ZK) for identity — Foja upgrade documented
- Base Sepolia as chain
- pnpm workspace monorepo with `packages/shared`
- Track *Best Use of KeeperHub* as primary submission
- `ITransport` abstraction so AXL/WebSocket are swap-able

### Plan-Level Decisions (Phase 3)

- 03-01: test:run uses vitest run --passWithNoTests so Wave 0 exits 0 before any spec files exist
- 03-01: pnpm-lock.yaml committed per Phase 2 D-01 lockfile convention
- 03-01: @types/node peer warning (vite 7 wants >=20.19.0, workspace has ^20.11.0) accepted as pre-existing

### Plan-Level Decisions (Phase 2)

- 02-01: Committed pnpm-lock.yaml; pinned TS 5.4.2 to override stale host global
- 02-02: Bare z.string() for pubkey/signature in shared (crypto byte-shape validation lives in Phase 3 with tweetnacl)
- 02-02: StatusChangeMsg.status enum locked to ['registered','awaiting','received','deprecated','revoked']
- 02-03: Operator alone does a value import from @sonar/shared (Open Question 3); covers WORK-02 smoke test
- 02-03: demo-ui keeps @sonar/shared dep, landing has no shared dep
- 02-03: apps/contract is a placeholder package.json only — Phase 5 owns toolchain (A5)

### Plan-Level Decisions (Phase 1)

- 01-01: Pinned R3F v8.17 + React 18.3 + framer-motion v11 (resolves RESEARCH §Conflicts; R3F v9 requires React 19, breaks UI-SPEC + CLAUDE.md lock)
- 01-01: Preserved tsconfig.base.json (NodeNext) for Phase 2 packages; apps/landing/tsconfig.json overrides to ESNext/Bundler/jsx/DOM. Avoids breaking Phase 2 typechecks.
- 01-01: HeroCanvas.tsx is a stub returning <HeroFallback /> until plan 03 ships the real R3F Canvas. Suspense boundary + lazy import + data-testid hooks in place; the swap is invisible to surrounding code.
- 01-01: rgba color tokens (border/grid/grain) live only in tokens.css, not tokens.ts (parity test skips rgba; R3F materials don't need them).
- 01-01: Inter Variable preload literal in index.html deferred to plan 04 (RESEARCH §Pitfall 5). Currently relying on font-display: swap.
- 01-01: Vercel project hookup auto-deferred under workflow.auto_advance=true; vercel.json ready, manual hookup at vercel.com/new is the one true human step.
- 01-02: App.tsx uses named `App` export (not default per plan task 7) to match main.tsx import created in plan 01 — avoids touching out-of-scope main.tsx.
- 01-02: Button enforces rel=noopener noreferrer + target=_blank for any http(s) href — mitigates threat T-01-02-02 once at the primitive layer.
- 01-02: FlowDiagram ships TWO <svg> elements (horizontal + vertical) toggled via CSS media query — keeps SSR output deterministic and avoids hydration mismatch.
- 01-02: Inter-section spacing comes from Section.module.css padding-block alone — Hero.module.css untouched (owned by plan 03 in this wave).
- 01-02: --color-accent-cyan-glow rgba token added to BOTH tokens.css and tokens.ts; parity test correctly skips rgba mismatches.
- 01-02: jsdom IntersectionObserver stubbed in test setup so framer-motion whileInView doesn't throw under Vitest.
- 01-03: Bumped @react-three/fiber to ^8.18.0 — 8.17.0 published tarball missing dist/declarations/src/* (TS types), blocking tsc -b.
- 01-03: Top-down ortho camera needed explicit rotation [-PI/2, 0, 0] AND mesh rotations to lie on XZ plane; RESEARCH §Pattern 3 omitted lookAt and the default -Z forward saw nothing.
- 01-03: Reduced-motion HeroCanvas returns <HeroFallback /> directly (not null) — Suspense fallback only renders during lazy load, returning null after resolve leaves the slot blank.
- 01-03: Animation-liveness e2e probes window.__pingFrames + __pingT (set inside useFrame) instead of pixel-diff via screenshot/toDataURL — headless WebGL framebuffer readback is unreliable across platforms.
- 01-04: web-vitals v5 attribution exposes the LCP element via attribution.target (CSS selector string) and attribution.lcpEntry.element (raw Element); `.element` shorthand from older docs does not exist in v5. reportWebVitals reads in priority: lcpEntry.element → attribution.element → attribution.target.
- 01-04: No remediation cascade applied — local LCP median 676ms and Vercel LCP median 395ms PASSED first run, both far under the 2000ms gate. Font preload + critical-CSS inlining + dpr-cap + geometry-simplification cascade documented as future regression recovery only.
- 01-04: Mobile keyboard-focus-ring assertion scoped to desktop project — touch viewports do not dispatch Tab events deterministically under Playwright; focus rings are not part of the locked mobile UI contract.
- 01-04: Task 4 (human-verify smoke on Vercel) auto-deferred under workflow.auto_advance=true; the automated Vercel LHCI assert in Task 3 is the binding LCP gate, not the manual DevTools audit.

### Deferred Decisions

- AXL real vs WebSocket fallback (decide at AXL integration; >2h friction → fallback)
- KeeperHub `distribute` node: native vs HTTP callback to Operator
- Demo UI mirror vs record Claude Desktop directly
- Landing deploy target (Vercel / Netlify / GitHub Pages)
- Hardhat vs Foundry for apps/contract (Phase 5)

### Open Todos

- Pick next phase to plan: Phase 1 (Landing — parallel track, zero deps) or Phase 3 (Operator + Runtime + Identity — gates Phases 4/5/6)

### Blockers

- None

## Session Continuity

- **Last action**: Executed Plan 01-04 (LCP/a11y/Lighthouse phase gate) on 2026-04-28 — 3 commits (1b8fd76, 7c38ba3, eadabb9). Local LHCI 3/3 PASS (LCP 490/676/688 ms), Vercel LHCI 3/3 PASS (LCP 354/395/398 ms vs https://sonar-henna.vercel.app/), LCP attribution proven = h1._display_*, axe-core WCAG2 A/AA clean. Phase 1 closed. Task 4 (human-verify) auto-deferred under workflow.auto_advance=true.
- **Next action**: Plan 03-04 (Runtime client) or 03-05 (Identity capstone tests) — Phase 3 is now the only open critical path before Phase 4/5/6 unblock.
- **Notes**: Phase 1 design-token contract locked (12+8+5+3+6 tokens with parity test). D-13 enforced via ESLint flat config no-restricted-syntax. LAND-04 LCP <= 2000ms gate is now CI-enforceable via .lighthouserc.cjs. Hero shell exposes data-testid hooks (hero, hero-canvas-slot) for stable Playwright selectors across plans 02-04.

### Plan 01-01 Performance Metrics

- Duration: ~8 min wall (3 atomic task commits + 5 deviation auto-fixes)
- Files: 28 created, 4 modified
- Test cases: 35 token parity (Vitest)
- Build size: dist/assets/index-*.js = 147 KB raw / 47.6 KB gzip (under chunkSizeWarningLimit 200 — three.js will be split to a HeroCanvas chunk in plan 03)

---
*State initialized: 2026-04-27*
*Last updated: 2026-04-27 (Phase 2 complete)*

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-04-29T00:30:00.000Z"
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# State: Sonar

## Project Reference

- **Core Value**: A clone of a runtime's binary cannot intercept rotated credentials — identity is verified cryptographically (Ed25519) at the last mile, and the LLM never sees the private key by construction.
- **Current Focus**: ETHGlobal OpenAgents submission, track *Best Use of KeeperHub*, deadline 2026-05-03.
- **Mode**: yolo
- **Granularity**: standard
- **Parallelization**: enabled

## Current Position

Phase: 04 (sonar-mcp-server) — COMPLETE
Plan: 4 of 4

- **Phase**: 01-public-landing (DONE) || 02-workspace-foundation (DONE) || 03-operator-runtime-identity-core (DONE) || 04-sonar-mcp-server (4/4 plans complete — DONE)
- **Plan**: Phase 4 complete — three MCP tools registered, README contract enforced, 37/37 mcp tests green
- **Status**: Plans 04-01..04 executed across 3 waves — apps/mcp scaffolded, config + RingBuffer + operator HTTP/WS clients, list_runtimes/revoke/get_workflow_log tools + buildMcpServer + stdio entry, README + readme.contract grep test. Total: operator 35/35, runtime 11/11, mcp 37/37 green.
- **Progress**: 4/7 phases complete

```
[████░░░] 4/7
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 7 |
| Phases complete | 2 |
| v1 Requirements mapped | 40/40 |
| Plans complete | 8 |
| Days to deadline | 5 (as of 2026-04-28) |
| Phase 03 P05 | 8 min | - tasks | - files |

## Accumulated Context

### Key Decisions (from PROJECT.md)

- Ed25519 challenge/response (not ZK) for identity — Foja upgrade documented
- Base Sepolia as chain
- pnpm workspace monorepo with `packages/shared`
- Track *Best Use of KeeperHub* as primary submission
- `ITransport` abstraction so AXL/WebSocket are swap-able

### Plan-Level Decisions (Phase 4)

- 04-01: zod bumped to ^3.25 workspace-wide (MCP SDK peer); pnpm-lock.yaml committed per Phase 2 D-01 lockfile convention
- 04-01: stderr-only logger in apps/mcp/src/util/log.ts; no-stdout grep test excludes util/log.ts itself
- 04-02: WS reconnect backoff verified via real-clock timing (vitest fake timers blocked `ws` 'message' delivery); 30s cap asserted via direct Math.min formula instead of timing walk
- 04-02: ws-server tests must iterate `wss.clients` and `terminate()` each in `afterEach` before `wss.close()` — `WebSocketServer.close(cb)` does not terminate active clients
- 04-03: MCP tool test seam = `(server as any)._registeredTools[name].handler` (NOT `.callback` as RESEARCH suggested) — confirmed at dist/esm/server/mcp.d.ts:274
- 04-03: revoke pre-checks GET /runtimes to surface `runtime_not_found` / `already_revoked` because Operator's `forceRevoke` is idempotent (200 even for missing/already-revoked ids)
- 04-04: README absolute-path snippet uses `<ABSOLUTE-PATH-TO-SONAR>/apps/mcp/dist/index.js` placeholder per Pitfall 4; readme.contract grep test enforces 7 invariants

### Plan-Level Decisions (Phase 3)

- 03-01: test:run uses vitest run --passWithNoTests so Wave 0 exits 0 before any spec files exist
- 03-01: pnpm-lock.yaml committed per Phase 2 D-01 lockfile convention
- 03-01: @types/node peer warning (vite 7 wants >=20.19.0, workspace has ^20.11.0) accepted as pre-existing
- 03-05: nonceTtlMs test seam: scoped factory in tests only (not on HandshakeCoordinator constructor); compile-time only per T-03-36
- 03-05: forceRevoke idempotence: guard registry.get() before setStatus — revoke of nonexistent id is no-op 200
- 03-05: registry.persist flaky test fixed — per-uuid tmp prefix scan instead of full tmpdir scan

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

- **Last action**: Executed Phase 4 (sonar-mcp-server) on 2026-04-29 — 4 plans across 3 waves; 11 commits (418f18a, 057e6b5, 82a8aab, 23e51b2, 1bbb955, 8c23053, 33c806a, a9e5084, b232e71, 9cec80c, 117283d, 3b7342b). apps/mcp scaffolded with config + RingBuffer + operator HTTP/WS clients, three MCP tools (list_runtimes / revoke / get_workflow_log), buildMcpServer factory, stdio entry, README + contract test. operator 35/35 + runtime 11/11 + mcp 37/37 green.
- **Next action**: Phase 5 (On-Chain + KeeperHub workflow) — needs research per the KeeperHub deep-dive directive.
- **Notes**: Phase 1 design-token contract locked (12+8+5+3+6 tokens with parity test). D-13 enforced via ESLint flat config no-restricted-syntax. LAND-04 LCP <= 2000ms gate is now CI-enforceable via .lighthouserc.cjs. Hero shell exposes data-testid hooks (hero, hero-canvas-slot) for stable Playwright selectors across plans 02-04.

### Plan 01-01 Performance Metrics

- Duration: ~8 min wall (3 atomic task commits + 5 deviation auto-fixes)
- Files: 28 created, 4 modified
- Test cases: 35 token parity (Vitest)
- Build size: dist/assets/index-*.js = 147 KB raw / 47.6 KB gzip (under chunkSizeWarningLimit 200 — three.js will be split to a HeroCanvas chunk in plan 03)

---
*State initialized: 2026-04-27*
*Last updated: 2026-04-27 (Phase 2 complete)*

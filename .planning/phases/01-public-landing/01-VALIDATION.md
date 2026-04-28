---
phase: 1
slug: public-landing
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | Vitest (unit/component) + Playwright (e2e) + Lighthouse CI (`@lhci/cli`) + `web-vitals/attribution` |
| **Config files** | `apps/landing/vitest.config.ts`, `apps/landing/playwright.config.ts`, `apps/landing/.lighthouserc.cjs` (Wave 0 installed all three) |
| **Quick run command** | `pnpm -F @sonar/landing test` (Vitest watch=false) |
| **Full suite command** | `pnpm -F @sonar/landing test && pnpm -F @sonar/landing test:e2e && pnpm -F @sonar/landing lhci` |
| **Estimated runtime** | ~30s quick · ~2 min full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -F @sonar/landing test`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green AND Lighthouse LCP < 2000ms (desktop) on `vite preview` build
- **Max feedback latency:** 30 seconds for quick run

---

## Per-Task Verification Map

| Task ID         | Plan  | Wave | Requirement     | Test Type            | Automated Command                                                                 | Status   |
|-----------------|-------|------|-----------------|----------------------|-----------------------------------------------------------------------------------|----------|
| plan-01-task-1  | 01-01 | 1    | LAND-01         | Build + workspace    | `pnpm install && pnpm -F @sonar/landing build`                                    | ✅ green |
| plan-01-task-2  | 01-01 | 1    | LAND-01         | Build + content scan | `pnpm -F @sonar/landing build && grep "Rotate keys" apps/landing/dist/index.html` | ✅ green |
| plan-01-task-3  | 01-01 | 1    | LAND-04 / D-13  | Vitest + ESLint + LHCI healthcheck | `pnpm -F @sonar/landing test && pnpm -F @sonar/landing lint && pnpm -F @sonar/landing exec lhci healthcheck` | ✅ green |
| plan-02-task-1  | 01-02 | 2    | LAND-03 / D-13  | Vitest (Button + tokens parity) | `pnpm -F @sonar/landing test`                                          | ✅ green |
| plan-02-task-2  | 01-02 | 2    | LAND-03         | Vitest sections.test + ESLint | `pnpm -F @sonar/landing test && pnpm -F @sonar/landing lint`              | ✅ green |
| plan-02-task-3  | 01-02 | 2    | LAND-03         | Playwright sections + copy + responsive + reduced-motion | `pnpm -F @sonar/landing test:e2e` | ✅ green |
| plan-03-task-1  | 01-03 | 2    | LAND-02         | Vitest NodeBadge + R3F shared nodes | `pnpm -F @sonar/landing test`                              | ✅ green |
| plan-03-task-2  | 01-03 | 2    | LAND-02         | Build + bundle-split (three.js NOT in main) | `pnpm -F @sonar/landing build && grep -L three dist/assets/index-*.js` | ✅ green |
| plan-03-task-3  | 01-03 | 2    | LAND-02         | Playwright hero-canvas (mount, FPS>=50, NodeBadge labels, reduced-motion) | `pnpm -F @sonar/landing test:e2e --grep "Hero R3F canvas"` | ✅ green |
| plan-04-task-1  | 01-04 | 3    | LAND-04         | Playwright LCP attribution + axe-core a11y | `pnpm -F @sonar/landing exec playwright test --grep "LCP attribution\|Accessibility"` | ✅ green |
| plan-04-task-2  | 01-04 | 3    | LAND-04 / D-17  | Lighthouse CI local (vite preview, 3 runs, desktop preset) | `pnpm -F @sonar/landing lhci`                  | ✅ green (LCP 490/676/688 ms; CLS 0/0/0) |
| plan-04-task-3  | 01-04 | 3    | LAND-04 / D-17  | Lighthouse CI vs live Vercel preview (3 runs)             | `pnpm -F @sonar/landing exec lhci collect --url=$(cat apps/landing/.vercel-preview-url) --numberOfRuns=3 --settings.preset=desktop --settings.throttlingMethod=simulate && pnpm -F @sonar/landing exec lhci assert --config=./.lighthouserc.vercel.cjs` | ✅ green |
| plan-04-task-4  | 01-04 | 3    | LAND-01..04     | Human visual + a11y smoke on Vercel preview              | manual (auto-deferred under workflow.auto_advance=true)                          | ⬜ deferred |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/landing/vitest.config.ts` + `apps/landing/src/test/setup.ts`
- [x] `apps/landing/playwright.config.ts` + base e2e fixture (`tests/e2e/smoke.spec.ts`)
- [x] `apps/landing/.lighthouserc.cjs` with assertion: `largest-contentful-paint <= 2000` (desktop preset)
- [x] `web-vitals` runtime hook for in-browser LCP/CLS attribution capture (`src/lib/reportWebVitals.ts`)
- [x] ESLint flat config with `no-restricted-syntax` rule banning hex/px literals in `src/components/**` and `src/sections/**` (D-13)
- [ ] CI workflow stub (or local script) that runs `vite build && vite preview &` then `lhci autorun` *(plan 04 owns the full LHCI run; healthcheck wired here)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Hero looks alive on first paint" subjective polish | LAND-02 | Visual judgment | Open deployed Vercel preview on a typical laptop; confirm autonomous ping cadence reads as a living sonar scope (not stutter, not blank) |
| Vercel preview URL exists for the PR | LAND-01 | Out-of-repo signal | Confirm Vercel bot comment on PR with preview link; smoke-test the link |
| 90s demo video CTA wired to Phase 7 artifact | LAND-03 | Phase 7 dep | Placeholder OK during Phase 1; verified at Phase 7 sign-off |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers Vitest + Playwright + LHCI + web-vitals install
- [x] No watch-mode flags in CI commands
- [x] Feedback latency < 30s for quick run
- [x] LCP gate (LAND-04) measurable via LHCI in CI
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (Wave 0 infrastructure landed by plan 01-01)

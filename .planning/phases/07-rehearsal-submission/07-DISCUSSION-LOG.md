# Phase 7: Rehearsal + Submission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 07-rehearsal-submission
**Areas discussed:** Rehearsal sequencing & fallback, Docs scope & README shape

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Rehearsal sequencing & fallback | Order of M-06/M-08/06-06 smoke + backup demo path | ✓ |
| Demo video plan | 90s shot list, language, recording tool, hosting | |
| Docs scope & README shape | ARCHITECTURE/UPGRADE-TO-FOJA/CLAUDE-DESKTOP-SETUP/DEMO-SCRIPT depth + README quickstart shape | ✓ |
| Submission mechanics + Builder Feedback | ETHGlobal form, repo visibility, assets, SUBM-06 content | |

---

## Rehearsal Sequencing & Fallback

### Q1 — Gate closure order

| Option | Description | Selected |
|--------|-------------|----------|
| M-06 → M-08 → 06-06 smoke | Bottom-up: workflow ID first, then Claude Desktop, then UI | ✓ |
| 06-06 smoke → M-08 → M-06 | UI-first | |
| All three in one rehearsal pass | Single dry-run | |

### Q2 — Fallback path

| Option | Description | Selected |
|--------|-------------|----------|
| WebSocket transport + recorded clone scene | Drop AXL primary clause to deferred fallback; splice clone clip if needed | ✓ |
| Full pre-recorded video | Lower variance, no live segment | |
| Live demo only, no fallback | Ship as-is on failure | |

### Q3 — Fallback trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Hard cutoff 24h before deadline | Switch to fallback if not green by 2026-05-02 EOD | ✓ |
| On first failure during recording | Try live first | |
| Judge-by-judgment on the day | Decide at recording time | |

### Q4 — Clone scene mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| gamma-clone runtime tries handshake live | Boot 4th runtime with copied keypair | ✓ |
| Pre-recorded clone clip spliced in | Capture offline | |
| Show log replay only | No live binary | |

### Q5 — Number of rehearsals

| Option | Description | Selected |
|--------|-------------|----------|
| 2 rehearsals + 1 recorded take | First exposes issues; second confirms; third records | ✓ |
| 1 rehearsal + recorded take | Tighter | |
| Rehearse until 2 clean back-to-back runs | Quality-first | |

### Q6 — Operator on the take

| Option | Description | Selected |
|--------|-------------|----------|
| Single operator on screen-share | Live voiceover during take | ✓ |
| Voiceover in post over silent run | Cleaner audio, more edit time | |

---

## Docs Scope & README Shape

### Q1 — README quickstart shape

| Option | Description | Selected |
|--------|-------------|----------|
| Two paths: Watch + Run | Path A video/landing/contract; Path B local <5min | ✓ |
| Single 5-min developer path | Linear quickstart | |
| Three paths (judge/dev/contributor) | Adds contributor section | |

### Q2 — ARCHITECTURE.md depth

| Option | Description | Selected |
|--------|-------------|----------|
| 1-page overview + 1 sequence diagram | Component map + distribute handshake sequence | ✓ |
| Component map only | Faster, weaker on flow | |
| Component + sequence + threat model | Heavy; threat model belongs in UPGRADE-TO-FOJA | |

### Q3 — UPGRADE-TO-FOJA.md focus

| Option | Description | Selected |
|--------|-------------|----------|
| API-shape parity + ZK swap point | ITransport unchanged; only proof primitive swaps | ✓ |
| Full ZK design proposal | Sketch circuit + verifier | |
| Short paragraph note | Minimum to satisfy SUBM-05 | |

### Q4 — DEMO-SCRIPT + CLAUDE-DESKTOP-SETUP depth

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim run + copy-paste config | Doubles as rehearsal checklist + voiceover storyboard | ✓ |
| High-level beats only | Lighter; loses double-use | |

### Q5 — Diagram tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Mermaid in-markdown | Inline GitHub render, version-controlled | ✓ |
| Static PNG/SVG | Visual control, sync overhead | |
| ASCII art | Simplest, weak for sequences | |

### Q6 — README cross-link style

| Option | Description | Selected |
|--------|-------------|----------|
| Single "Documentation" section with one-liners | Scannable; placed after quickstart paths | ✓ |
| Inline links sprinkled through quickstart | Contextual, harder to skim | |

### Q7 — Where docs live during cutoff

| Option | Description | Selected |
|--------|-------------|----------|
| Drafts on main, polished by 24h cutoff | Aligns with rehearsal hard cutoff | ✓ |
| Branch until video recorded, then merge | Lower noise, merge crunch risk | |

---

## Claude's Discretion
- Demo language (ES/EN) — decided at recording time per CLAUDE.md
- Recording tool, video hosting — Claude picks during planning
- Builder Feedback Bounty content — Claude drafts, user reviews
- ETHGlobal submission form mechanics — Claude handles in plan, human-do checklist

## Deferred Ideas
- Demo video plan area not discussed (Claude decides under D-03/D-11)
- Submission mechanics + Builder Feedback area not discussed (Claude drafts)

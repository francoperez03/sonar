# Phase 7: Rehearsal + Submission - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the live end-to-end demo run, record the 90-second video, write the four submission docs, and ship the ETHGlobal OpenAgents submission (track *Best Use of KeeperHub*) plus the Builder Feedback Bounty before 2026-05-03. Two areas were discussed; the other two (Demo video plan, Submission mechanics + Builder Feedback) are deferred to research/planning with sensible defaults.

</domain>

<decisions>
## Implementation Decisions

### Rehearsal Sequencing
- **D-01:** Close pending human gates in order **M-06 → M-08 → Plan 06-06 Task 3 smoke**. Bottom-up: real KeeperHub workflow ID published first, then Claude Desktop wiring sees it, then demo UI surfaces the live run end-to-end. **Status (2026-05-01):** M-06 ✅ closed (live verification, see 05-DISCUSSION-LOG.md "Reconciliation Pass 2"), M-08 ✅ closed via 04-VERIFICATION.md round-trip 2026-04-30. Only Plan 06-06 Task 3 browser smoke remains.
- **D-02:** Run **2 full rehearsals + 1 recorded take**. Rehearsal 1 surfaces timing/copy issues; rehearsal 2 confirms fixes; take 3 is the recording.
- **D-03:** Single operator (Franco) drives Claude Desktop on screen-share with live voiceover during the recorded take. No silent run + post-narration.
- **D-04:** IDEN-02 clone-rejection is demonstrated **live** by booting a 4th `gamma-clone` runtime that reuses gamma's pubkey against the live Operator. Rejection appears in the WS log mid-demo. (Phase 3 fleet-smoke and Phase 6 canvas already model this.)

### Fallback Policy
- **D-05:** Hard cutoff at **2026-05-02 EOD (24h before deadline)**. If all three gates (M-06, M-08, 06-06 smoke) are not green by that time, switch to fallback path. No judgment-call-on-the-day decisions.
- **D-06:** Fallback = **WebSocket transport demo + pre-recorded clone-rejection clip**. AXL primary clause stays merged in code (Phase 6 closed it), but the recorded demo runs on WebSocket transport (Phase 3 baseline) for variance reduction. Clone-rejection clip captured offline and spliced into the video if a live re-run is risky on take day. **Status (2026-05-01): fallback only — primary on-chain path live-verified end-to-end via M-06 closure.** Retained as contingency: KeeperHub returned Cloudflare 521/524 twice during the verification session, so the WebSocket-transport contingency is non-trivially valuable on demo day. Pre-record the clone-rejection clip during rehearsal 1 regardless.
- **D-07:** Fallback invocation is automatic at the cutoff — not deferred to recording-time judgment. This protects edit + submission time.

### Documentation
- **D-08:** README has **two clearly labeled paths**: Path A "Watch the demo" (video link + landing URL + deployed FleetRegistry contract address on Base Sepolia) and Path B "Run it locally" (pnpm install, env setup, `dev:fleet`, Claude Desktop config). Path B targets the SUBM-01 <5-minute reproducibility bar.
- **D-09:** **ARCHITECTURE.md = 1-page overview + 1 sequence diagram.** Component map shows Operator/Runtime/MCP/KeeperHub/Contract; sequence diagram captures the `distribute` Ed25519 challenge/response handshake (the "last mile identity" story). No threat model in this doc.
- **D-10:** **UPGRADE-TO-FOJA.md focus = API-shape parity + ZK swap point.** ITransport / handshake API stays identical; only the proof primitive swaps Ed25519 → ZK. Calls out FOJA-01 / FOJA-02 v2 requirements and the verifier-contract seam. Sells "demo is upgrade-ready."
- **D-11:** **DEMO-SCRIPT.md = verbatim run** (prompts, expected log lines, expected timestamps). Doubles as the rehearsal checklist and the voiceover storyboard for the video.
- **D-12:** **CLAUDE-DESKTOP-SETUP.md = copy-paste config + screenshots.** Copy-paste MCP server config block plus screenshots of Claude Desktop showing the 4 Sonar tools registered.
- **D-13:** Diagrams produced as **inline Mermaid in markdown**. No PNG/SVG asset maintenance, renders on GitHub.
- **D-14:** README links to the four docs in a single **"Documentation" section with one-liners**, placed after both quickstart paths. Each bullet describes when to read the doc.
- **D-15:** Doc skeletons drafted during rehearsal day(s) on `main`; final copy frozen at **2026-05-02 EOD** to align with the rehearsal hard cutoff (D-05). No long-lived doc branch.

### Claude's Discretion
- Demo language (ES vs EN voiceover) — decided at recording time per CLAUDE.md; planner does not lock.
- Recording tool (Loom / OBS / screen.studio) — Claude can pick during planning.
- Video hosting (unlisted YouTube vs uploaded asset) — Claude can pick; README links to it from Path A regardless.
- Builder Feedback Bounty (SUBM-06) content — Claude drafts from accumulated Phase 4/5 pain points; user reviews before submit.
- ETHGlobal submission form mechanics (which fields, asset uploads, repo public-vs-private toggle) — Claude handles in plan; surfaces a final human-do checklist.

### Folded Todos
None — no pending todos cross-referenced for this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 7: Rehearsal + Submission" — phase goal, success criteria, requirement mapping
- `.planning/REQUIREMENTS.md` §Submission Package — SUBM-01..06 acceptance language

### Prior phase context (carry forward)
- `.planning/phases/03-operator-runtime-identity-core/` — fleet-smoke.sh demo script, IDEN-01/02/03 invariant tests (basis for D-04 live clone scene)
- `.planning/phases/05-on-chain-keeperhub-workflow/05-MANUAL-OPS.md` — exhaustive list of human-only operations (M-06, M-08); read before planning the rehearsal checklist
- `.planning/phases/05-on-chain-keeperhub-workflow/05-05-SUMMARY.md` §M-08 — exact Claude Desktop quit/relaunch + 4-tool visibility check procedure
- `.planning/phases/06-demo-ui-axl-transport/06-VERIFICATION.md` — Phase 6 verifier verdict and the human_needed gate referenced by Plan 06-06 Task 3
- `.planning/phases/06-demo-ui-axl-transport/06-06-SUMMARY.md` — AXL primary-clause closure + WebSocket fallback documentation (referenced by D-06)

### Project & state
- `CLAUDE.md` — demo language decided at recording time; deadline 2026-05-03; track *Best Use of KeeperHub*
- `.planning/PROJECT.md` — core value statement and Foja-upgrade narrative used in UPGRADE-TO-FOJA.md (D-10)
- `.planning/STATE.md` — current pending human gates that must close before SUBM-03

### External
- ETHGlobal OpenAgents submission portal (URL captured at submission planning time)
- KeeperHub Builder Feedback Bounty submission channel (URL captured at submission planning time)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/operator/scripts/fleet-smoke.sh` (Phase 3) — boots alpha/beta/gamma + clone scenario; basis for D-04 live clone scene during the take
- `apps/keeperhub/` — workflow.json + publish-workflow + poll-execution; M-06 exercises this end-to-end
- `apps/mcp/README.md` §5 — already documents the Claude Desktop restart + 4-tool visibility procedure (M-08)
- `apps/demo-ui/` — chat mirror + event log + canvas (alpha/beta/gamma/gamma-clone nodes already wired); the live UI surface for the recording
- Live landing site `https://sonar-henna.vercel.app/` — Path A "Watch the demo" target in the README (D-08)
- Deployed FleetRegistry on Base Sepolia (Phase 5 deployments/base-sepolia.json) — contract address surfaced in Path A

### Established Patterns
- `apps/mcp/README.md` ordering convention (CONTEXT D-18 from Phase 4) — repo README should mirror the same install-then-verify shape
- Mermaid is not yet used in the repo; D-13 introduces it. GitHub renders it natively in `.md` — no tooling change needed.

### Integration Points
- README sits at repo root `README.md`
- Docs land in `docs/` (per ROADMAP.md success criteria #3): `docs/ARCHITECTURE.md`, `docs/UPGRADE-TO-FOJA.md`, `docs/CLAUDE-DESKTOP-SETUP.md`, `docs/DEMO-SCRIPT.md`
- Video URL gets injected into README Path A and into the ETHGlobal submission form

</code_context>

<specifics>
## Specific Ideas

- The "last mile identity" framing is the headline narrative — ARCHITECTURE.md's sequence diagram and the video voiceover should both lean on this exact phrase.
- DEMO-SCRIPT.md is dual-purpose: rehearsal checklist + voiceover storyboard. Plan should not produce two separate artifacts.
- The recorded clone-rejection scene (fallback per D-06) is captured during rehearsal 1 or 2 as a contingency, before the final take — not produced ad hoc on submission day.

</specifics>

<deferred>
## Deferred Ideas

- **Demo video plan area** — recording tool, language, hosting, single-take vs edited: not discussed; Claude decides during planning under D-03 (single operator + live voiceover) and D-11 (DEMO-SCRIPT as storyboard).
- **Submission mechanics + Builder Feedback Bounty area (SUBM-04, SUBM-06)** — ETHGlobal form fields, repo visibility, asset attachments, KeeperHub feedback content: not discussed; Claude drafts in plan and surfaces a human-do checklist before submit.
- v2 hardening (HARD-01..04) and full Foja ZK design — out of scope per REQUIREMENTS.md v2 list; UPGRADE-TO-FOJA.md only references them as forward direction.

</deferred>

---

*Phase: 07-rehearsal-submission*
*Context gathered: 2026-05-01*

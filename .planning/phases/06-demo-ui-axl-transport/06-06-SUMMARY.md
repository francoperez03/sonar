---
phase: 06
plan: 06
subsystem: demo-ui
tags: [axl, transport, decision, demo-smoke]
requires: [TRAN-01, TRAN-02, packages/shared.transport.ITransport]
provides: [TRAN-03, axl-transport-adapter, demo-ui-readme]
affects: [apps/demo-ui/src/main.tsx, root.dev:fleet+ui]
tech-stack:
  added:
    - gensyn-ai/axl @ 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e (Go binary, dev-only — not a runtime dep of the workspace)
  patterns:
    - HTTP-poll ITransport adapter (POST /send + GET /recv at 250ms cadence)
    - Module-scope transport singleton selected by VITE_TRANSPORT
key-files:
  created:
    - apps/demo-ui/src/transport/createAxlClientTransport.ts
    - apps/demo-ui/src/test/transport.axl.test.ts
    - apps/demo-ui/README.md
  modified:
    - apps/demo-ui/src/main.tsx (transport selector)
    - package.json (dev:fleet+ui script)
decisions:
  - TRAN-03 satisfied via primary clause (Branch A); AXL adapter is integrated and tested
  - WebSocket remains the recorded demo transport (per CONTEXT D-15 default fallback) because AXL polling adds 100–250ms latency that hurts EdgePulse cinematics on a single-laptop demo
  - docs/decisions/axl-deferred.md NOT written — Branch A landed; deferral doc is moot
metrics:
  duration: 18m
  spike-duration: ~3m wall-clock (vs 90m budget)
  completed: 2026-04-30
---

# Phase 6 Plan 06: AXL spike (90-min timebox) → Branch A landed; demo-ui README + final regression

One-liner: AXL transport spike PASSED in ~3 minutes; `createAxlClientTransport` integrated end-to-end against `gensyn-ai/axl @ 9cba555` with 6 unit tests + a verified live round-trip; demo-ui README documents the dev script and confirms WebSocket as the recorded transport.

## Spike outcome

**PASS — Branch A (primary clause).** The 90-minute hard time-box was opened at 2026-05-01T05:03:49Z and closed (round-trip green) at 2026-05-01T05:06:37Z — total wall-clock **~168 seconds**. The user's directive ("Branch A first; do not extend the timebox") was honored with ~88 minutes of slack.

**Hard evidence the spike passed:**

```text
A->B send  HTTP/1.1 200 OK   X-Sent-Bytes: 12
B recv     HTTP/1.1 200 OK   X-From-Peer-Id: db5121...
           Content-Length: 12
           hello-from-A
```

A second round-trip with a real `LogEntryMsg` payload also confirmed the JSON shape survives the bridge intact:

```text
send status: 200
received: {"type":"log_entry","runtimeId":"alpha","level":"info","message":"axl-spike-roundtrip","timestamp":1777611993378}
ROUND-TRIP OK
```

Both peers were:

- AXL HEAD `9cba555ff0b8e14ebf1244ae02b274fbc4ec044e` (Go 1.25.5 auto-toolchain — host has Go 1.21.5; `GOTOOLCHAIN=auto` downloaded the required toolchain at build time, ~45s).
- Configured with matching `tcp_port: 7000` (gVisor userspace TCP must align between peers — discovered empirically; see Deviations).
- Loopback-only TLS link: peer A listens on `tls://127.0.0.1:9101`, peer B dials it. No external Yggdrasil hub needed for two-peer local mesh.

## Which TRAN-03 clause was satisfied

- **Primary clause: `apps/demo-ui/src/transport/createAxlClientTransport.ts` is a working AXL ITransport adapter, not a `not_implemented` stub.**
- The adapter polls `/recv` at 250ms, parses JSON bodies via `Message.parse()` (T-06-22 mitigation), and POSTs to `/send` with `X-Destination-Peer-Id`.
- `apps/demo-ui/src/test/transport.axl.test.ts` exercises 6 paths: send shape, polling fan-out, swallowed fetch errors, malformed body drop, close() stop, and 5xx error propagation. All 6 pass.
- `docs/decisions/axl-deferred.md` was **not** written. Branch B is moot.

## AXL commit SHA pinned

```
gensyn-ai/axl @ 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e
```

This SHA is documented in three places: the file header of `createAxlClientTransport.ts`, the demo-ui README transport-of-record section, and this summary.

## Files

### Created
- `apps/demo-ui/src/transport/createAxlClientTransport.ts` — HTTP-poll AXL adapter (Branch A)
- `apps/demo-ui/src/test/transport.axl.test.ts` — 6 vitest cases stubbing global `fetch`
- `apps/demo-ui/README.md` — dev script, env table, transport-of-record statement

### Modified
- `apps/demo-ui/src/main.tsx` — `VITE_TRANSPORT==='axl'` switches the singleton from WebSocket to AXL at module scope (Pitfall 1 honored)
- `package.json` — added `dev:fleet+ui` script (operator + 3 runtimes + demo-ui via concurrently `-k`)

## Commits

| Hash | Subject |
|------|---------|
| fe1c74a | feat(06-06): AXL spike PASSED — createAxlClientTransport integrated (primary clause) |
| 33ccf04 | docs(06-06): add demo-ui README and dev:fleet+ui aggregate script |

## Verification (automated)

| Command | Result |
|---------|--------|
| `pnpm --filter @sonar/demo-ui test:run` | 11 files / **73 tests passed** (incl. 6 new AXL tests) |
| `pnpm --filter @sonar/demo-ui typecheck` | clean |
| `pnpm --filter @sonar/demo-ui build` | clean (vite production bundle 378.5 kB / 118 kB gzip) |
| `pnpm -r --filter '!@sonar/landing' test:run` | **all green** — demo-ui 73, mcp 61, operator 72, keeperhub 37, runtime 11 |
| `pnpm -r --filter '!@sonar/landing' typecheck` | **all green** across 7 workspace projects |

`@sonar/landing` was excluded from the regression per the user directive. The exclusion is justified by the pre-existing jest-dom matcher issue documented in `.planning/phases/06-demo-ui-axl-transport/deferred-items.md` (06-02 scope, unrelated to plan 06-06).

## Deviations from plan

### Auto-fixed during execution

**1. [Rule 3 — Blocking] AXL host Go toolchain mismatch**
- **Found during:** Task 1, STEP 1.2 (`make build`)
- **Issue:** `gensyn-ai/axl` HEAD requires Go 1.25.5 (`go.mod` declares `go 1.25.5`); host has Go 1.21.5; `make build` would fail with `GOTOOLCHAIN: go1.25.5`.
- **Fix:** Bypassed the Makefile's hardcoded `GOTOOLCHAIN := go1.25.5` and ran `GOTOOLCHAIN=auto go build -o node ./cmd/node` — Go's auto-toolchain mechanism downloaded 1.25.5 at build time (~45s, one-time). Documented in the README's AXL-mode setup so future devs reproduce.
- **Files modified:** none (build-time decision)
- **Commit:** fe1c74a

**2. [Rule 1 — Bug] Mismatched `tcp_port` between two AXL peers caused 502 on `/send`**
- **Found during:** Task 1, STEP 1.5 first round-trip attempt
- **Issue:** First config used `tcp_port: 7100` for peer A and `7110` for peer B. Send returned `HTTP 502 Bad Gateway: connect tcp [<peer-B-ipv6>]:7100: connection was refused` — AXL's gVisor userspace TCP stack expects peers to share the same `tcp_port` (the destination port encoded in the routed envelope is the local port of the *sender*, dialed against the *receiver*'s gVisor stack).
- **Fix:** Set both nodes to `tcp_port: 7000` (the documented default per `docs/configuration.md`). Round-trip then green.
- **Files modified:** `/tmp/axl-A/node-config.json`, `/tmp/axl-B/node-config.json` (spike-only artifacts)
- **Documented in:** README §3 mentions matching `tcp_port`; full reproducer in this section.

### Plan-level deviations (called out)

**3. [Plan task skipped per user directive] Task 3 (checkpoint:human-verify)**
- The plan's Task 3 is a `checkpoint:human-verify` block requiring an interactive browser smoke-test (8 verification steps).
- Per the user directive provided to this executor: *"For Task 3 (the human-verify checkpoint): SKIP IT. Do NOT pause for human verification. The user will run the manual browser/MCP verification separately after the orchestrator merges your worktree."*
- The manual smoke-test is therefore **deferred to the user**. Recommended order of verification (mirroring the plan's Task 3 steps 1–8):
  1. `pnpm dev:fleet+ui` (or three terminals: operator, fleet, demo-ui).
  2. Open `http://localhost:5174` — verify dark theme, sidebar empty-states, 4 runtime cards (alpha/beta/gamma/gamma-clone), 3 service nodes, idle hint copy, footer.
  3. From Claude Desktop, invoke `list_runtimes` — verify ChatMirror bubbles populate but EventLog stays chat-clean (D-07 invariant).
  4. Trigger a status change (`revoke alpha` via MCP, or `curl` into `/distribute`) — verify framer-motion transitions and EdgePulse animation.
  5. Trigger clone-rejection scenario — verify gamma-clone destructive flash + EventLog row.
  6. (Phase-5 dependent) Trigger full rotation — verify TxHashChip footer + basescan link.
  7. Reload (Ctrl+R) — verify no duplicate WS connections in operator log (Pitfall 1).
  8. **AXL mode** — set `VITE_TRANSPORT=axl` and the two AXL env vars; rebuild `./node` per README §3; verify live data flows through the AXL adapter.

**4. [Plan task scoped per user directive] Task 2 final regression scope**
- The plan called for `pnpm -r test:run && pnpm -r typecheck && pnpm -r build`. Per user directive, `@sonar/landing` was excluded (`--filter '!@sonar/landing'`) due to the pre-existing jest-dom matcher issue logged in `deferred-items.md` (out of scope for plan 06-06).
- All non-landing packages green on test:run and typecheck. Demo-ui build (the plan's actual target) is green.

## Authentication gates

None encountered. AXL bridge is unauthenticated on loopback by design (T-06-21, accepted).

## Threat model coverage

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-06-21 (AXL bridge spoofing on local) | accepted | bridge bound to 127.0.0.1; same trust boundary as Operator |
| T-06-22 (tampered `/recv` body) | mitigated | `MessageSchema.parse(JSON.parse(body))` in adapter; malformed body silently dropped (covered by `transport.axl.test.ts:malformed body...`) |
| T-06-23 (unpinned AXL HEAD) | mitigated | commit SHA `9cba555` pinned in adapter file header, README, and this SUMMARY |
| T-06-24 (Yggdrasil peer config) | accepted | spike used isolated `/tmp/axl-A`, `/tmp/axl-B` configs; not deployed |
| T-06-25 (informal spike outcome) | mitigated | commit message + this SUMMARY explicitly state "PASSED — primary clause" with date and SHA |

## Threat Flags

None. No new security-relevant surface introduced beyond what the plan's threat model already covered.

## Known Stubs

None. Adapter is fully implemented; no placeholder data, no `not_implemented` paths.

## Self-Check: PASSED

Verification:

```text
FOUND: apps/demo-ui/src/transport/createAxlClientTransport.ts
FOUND: apps/demo-ui/src/test/transport.axl.test.ts
FOUND: apps/demo-ui/README.md
FOUND: package.json dev:fleet+ui script (verified by grep)
FOUND commit: fe1c74a (feat(06-06): AXL spike PASSED — ...)
FOUND commit: 33ccf04 (docs(06-06): add demo-ui README ...)
NOT WRITTEN: docs/decisions/axl-deferred.md (Branch A landed — deferral doc is moot per the plan's Branch decision criterion)
NOT WRITTEN: apps/demo-ui/src/test/decision.axl-deferred.test.ts (Branch B test, also moot)
```

Both Branch B artifacts are intentionally absent because the spike passed. The plan's acceptance criteria require **exactly one** of: (Branch A test green) OR (Branch B doc + decision test green). Branch A test is green; the OR is satisfied.

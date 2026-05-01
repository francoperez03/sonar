# @sonar/demo-ui

React demo that mirrors a live KeeperHub rotation — chat, events, runtime
status transitions, on-chain deprecation footer.

The UI subscribes to the Operator's `/logs` WebSocket (default) or to a
local AXL bridge (opt-in via `VITE_TRANSPORT=axl`). All visual state is
driven by `Message`s from `@sonar/shared` — there is no polling and no
mock data path in production builds.

---

## 1. Dev script — start the full demo locally

The combined script boots the Operator, three runtimes (alpha, beta, gamma),
and the Vite dev server in parallel:

```bash
pnpm dev:fleet+ui
```

This is equivalent to running, in separate terminals:

```bash
pnpm --filter @sonar/operator dev          # Operator on :8080 (HTTP) and :8080/logs (WS)
pnpm dev:fleet                              # alpha + beta + gamma runtimes
pnpm --filter @sonar/demo-ui dev            # Vite on http://localhost:5174
```

Then drive the demo from Claude Desktop (the Sonar MCP server must be
configured per `apps/mcp/README.md`):

- Invoke `list_runtimes` — the ChatMirror gains user/assistant bubbles;
  the EventLog stays empty (chat events do not flow into the EventLog
  per the D-07 invariant).
- Invoke `revoke alpha` (or `run_rotation` if Phase 5 is live) — runtime
  cards transition `registered → awaiting → received → deprecated` with
  framer-motion edge pulses.

---

## 2. Environment

| Var                        | Default                       | Purpose                                                                                       |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| `VITE_OPERATOR_WS_URL`     | `ws://localhost:8080/logs`    | Operator log-stream URL. Override only if the Operator runs on a non-default host or port.    |
| `VITE_TRANSPORT`           | `ws`                          | Set to `axl` to route the demo through a local AXL bridge instead of the Operator WebSocket. |
| `VITE_AXL_BRIDGE_URL`      | `http://127.0.0.1:9002`       | AXL local HTTP bridge URL (only consulted when `VITE_TRANSPORT=axl`).                         |
| `VITE_AXL_DEST_PEER_ID`    | _(empty)_                     | 64-char hex ed25519 public key of the remote AXL peer (the Operator-side AXL node).           |

---

## 3. Transport of record for the demo

**WebSocket is the default and recorded transport.** The
`createBrowserClientTransport` adapter (Phase 3 ITransport interface)
streams `Message`s from `ws://localhost:8080/logs` directly into the
module-level store — no polling, no envelope rewriting.

**AXL transport is also integrated** end-to-end via
`gensyn-ai/axl @ 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e` (Phase 6 plan
06-06 spike, primary clause). To exercise it:

```bash
# Build the AXL node binary (one-time):
git clone https://github.com/gensyn-ai/axl /tmp/axl-spike
cd /tmp/axl-spike && GOTOOLCHAIN=auto go build -o node ./cmd/node

# Run two AXL nodes locally with matching tcp_port; copy peer A's public
# key into VITE_AXL_DEST_PEER_ID for the UI side. See
# .planning/phases/06-demo-ui-axl-transport/06-RESEARCH.md §AXL Deep-Dive
# for the full node-config.json shape.

VITE_TRANSPORT=axl \
VITE_AXL_BRIDGE_URL=http://127.0.0.1:9012 \
VITE_AXL_DEST_PEER_ID=<peer-A-pubkey-hex64> \
pnpm --filter @sonar/demo-ui dev
```

The recorded demo uses WebSocket because (a) AXL's `/recv` is
polling-based and adds 100–250ms of latency to the cyan EdgePulse
animations, and (b) the demo runs on a single laptop where AXL's
decentralization value does not visually surface. The AXL adapter is
production-shaped for v2 deploys.

---

## 4. Build / test

```bash
pnpm --filter @sonar/demo-ui build       # tsc -b && vite build
pnpm --filter @sonar/demo-ui test:run    # vitest run (73 tests)
pnpm --filter @sonar/demo-ui typecheck   # tsc --noEmit
```

---

## 5. Pitfalls (consult `06-RESEARCH.md` §Common Pitfalls for the full set)

- **The transport is a singleton at module scope** (`main.tsx`). Never
  re-create it inside a `useEffect` — under React StrictMode the effect
  would fire twice in dev, opening two WebSocket connections (Pitfall 1).
- **`@sonar/shared` must be built** before running tests or the dev
  server: `pnpm --filter @sonar/shared build`. Vite resolves the
  workspace package from its `dist/` output (Pitfall 6).
- **Hardcoded `ws://localhost:8080`** would break a Vercel build —
  always go through `VITE_OPERATOR_WS_URL` (Pitfall 8).

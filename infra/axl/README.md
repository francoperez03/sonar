# AXL transport — local two-node mesh

This folder runs a two-node `gensyn-ai/axl` mesh on loopback so the demo-ui
can opt into a peer-to-peer transport (in addition to the default WebSocket).

```
[scripts/axl-bridge.mjs]──POST /send──▶ Node A (api 9001, tls 9101)
                                              │  p2p
                                              ▼
[apps/demo-ui]◀──GET /recv (poll 250ms)──── Node B (api 9002)
```

Pinned to `gensyn-ai/axl @ 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e` (Phase 6 plan 06-06 spike).

## One-time setup

```bash
# 1. Get the prebuilt binary (already exists in /tmp/axl-spike from the 06-06 spike)
cp /tmp/axl-spike/node infra/axl/bin/axl-node
chmod +x infra/axl/bin/axl-node

# 2. Generate keys (idempotent — skips if files exist)
./infra/axl/setup.sh
```

If you don't have `/tmp/axl-spike`, rebuild from source:

```bash
git clone https://github.com/gensyn-ai/axl /tmp/axl-spike
cd /tmp/axl-spike
git checkout 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e
GOTOOLCHAIN=auto go build -o node ./cmd/node
cp node /Users/.../infra/axl/bin/axl-node
```

## Run the mesh

Two terminals (or use `pnpm dev:axl` from the repo root):

```bash
./infra/axl/start-a.sh   # api 9001, listen tls 9101
./infra/axl/start-b.sh   # api 9002, dials A
```

Verify both peers are linked:

```bash
curl -s http://127.0.0.1:9001/topology | python3 -m json.tool | head -20
curl -s http://127.0.0.1:9002/topology | python3 -m json.tool | head -20
```

Each side should report the other under `"peers"` with `"up": true`.

## Pubkeys you'll need

```bash
# Node A's pubkey (forwarder POSTs *from* A; browser uses this as VITE_AXL_DEST_PEER_ID)
A_PUB=$(curl -s http://127.0.0.1:9001/topology | python3 -c "import json,sys; print(json.load(sys.stdin)['our_public_key'])")

# Node B's pubkey (forwarder addresses this — X-Destination-Peer-Id)
B_PUB=$(curl -s http://127.0.0.1:9002/topology | python3 -c "import json,sys; print(json.load(sys.stdin)['our_public_key'])")
```

## Demo-ui env vars

Add to `apps/demo-ui/.env.local`:

```
VITE_AXL_BRIDGE_URL=http://127.0.0.1:9002
VITE_AXL_DEST_PEER_ID=<A_PUB from above>
```

## Forwarder env vars

The WS→AXL bridge (`scripts/axl-bridge.mjs`) reads:

```
OPERATOR_WS_URL=ws://localhost:8787/logs   # default
AXL_SEND_URL=http://127.0.0.1:9001/send    # default
AXL_DEST_PEER_ID=<B_PUB from above>        # required
```

## Pitfalls (from the spike, 06-06-SUMMARY)

1. **`tcp_port` must match** between A and B (gVisor TCP envelope alignment). Both configs hardcode `7000`.
2. **Don't mix `Listen` keys** — only A listens, B dials. If both listen, peering goes wonky.
3. **Polling cadence is 250 ms** in the adapter; expect ~100–250 ms more event latency than the WS path. EdgePulse cinematics may feel slightly less crisp.

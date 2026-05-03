# Sonar — Live Demo Script (~3 min)

## Context

Live end-to-end demo for ETHGlobal OpenAgents: start on the landing page, walk through the problem/approach, click into the demo app, exercise the four agent actions (list / rotate / clone-attack / reset), and keep KeeperHub open in parallel to prove the on-chain workflow. Goal: the judge sees (a) the product narrative, (b) the system reacting in real time, and (c) verifiable evidence (chain + KH dashboard).

---

## 0. Pre-flight — before going live

### 0.1 Terminals (order matters)

```bash
# Terminal 1 — operator (port 8787)
pnpm --filter @sonar/operator dev

# Terminal 2 — alpha runtime (required for a real rotation)
RUNTIME_ID=alpha pnpm --filter @sonar/runtime dev

# Terminal 3 — keeperhub poller (port 8788, broadcasts on-chain events to the operator)
pnpm --filter @sonar/keeperhub dev

# Terminal 4 — ngrok pointing at the operator
ngrok http --url=christian-actinographic-impliedly.ngrok-free.dev 8787
# Confirm the URL matches the workflow.json endpoints:
#   apps/keeperhub/workflow.json → endpoints

# Terminal 5 — optional, AXL p2p (only if you want to demo the toggle)
./infra/axl/start-a.sh   # node A (api 9001, tls 9101)
./infra/axl/start-b.sh   # node B (api 9002, peers with A)
B_PUB=$(curl -s http://127.0.0.1:9002/topology | python3 -c "import json,sys; print(json.load(sys.stdin)['our_public_key'])")
AXL_DEST_PEER_ID="$B_PUB" node scripts/axl-bridge.mjs
```

### 0.2 Quick health check (60 seconds before going live)

```bash
curl -sS -o /dev/null -w "ngrok: %{http_code}\n" \
  https://christian-actinographic-impliedly.ngrok-free.dev/runtimes \
  -H "ngrok-skip-browser-warning: 1"
# expected: 200
```

Open `https://sonar-demo-ui.vercel.app/`. You should see:
- Topbar: `● LIVE  christian-actinographic-…/logs  VIA WS  · last event Xs ago`
- Topbar right: `● READY` and `FLEET REGISTRY 0x7edd…b31f`
- Canvas: ALPHA registered with a balance, BETA/GAMMA in any state, GAMMA-CLONE as a ghost
- Sidebar OPERATOR STREAM: recent events
- If BETA or GAMMA show `revoked`, **fire "Reset demo" from the chat before you start**.

### 0.3 Browser tabs (in this order)

| Tab | URL | Purpose |
|---|---|---|
| 1 | Landing page (the deploy that hosts Hero + DemoCtaSection — "Open the live demo" CTA) | Demo opener |
| 2 | `https://sonar-demo-ui.vercel.app/` | Live app |
| 3 | `https://app.keeperhub.com/workflows/zu25iauu5jkv2bw9xngnl` | KeeperHub workflow dashboard |
| 4 | `https://sepolia.basescan.org/address/0x7eddfc8953a529ce7ffb35de2030f73aad89b31f` | FleetRegistry contract |

---

## 1. Opening — landing (~30 s)

**Tab 1 (landing).** Show the hero, no scroll yet.

> "Sonar is a system to rotate credentials without ever showing the LLM a single private key. The promise is right there at the top: **Rotate keys without trusting the agent**."

Slowly scroll to `01 / PROBLEM`.

> "The problem. Today an agent holding secrets in its context is a liability — one poisoned log line and the key walks. **OWASP LLM06**. Sonar never shows the LLM a key."

Scroll to `02 / APPROACH`.

> "The approach. The LLM orchestrates the full rotation — generate wallets, fund them, distribute, and deprecate the old ones on-chain — but every runtime has to sign a challenge before receiving anything. No valid signature, no key. Clones don't pass."

Scroll to `03 / SEE IT RUN`. Click **"Open the live demo"**.

---

## 2. First look at the app (~20 s)

**Tab 2 (demo app).** Pause. Walk the eye through the topbar first.

> "Up top: on the left, the badge tells me I'm live, connected to the operator over WebSocket. I can swap the transport to AXL p2p with one click — we'll get there. On the right: rotation status, and the FleetRegistry contract on Base Sepolia, where the old wallets get deprecated."

Click the `0x7edd…b31f` chip (opens a new tab).

> "There it is, on basescan."

Back to the demo tab.

> "The canvas: three legitimate runtimes — alpha, beta, gamma — and a fourth, gamma-clone, shown in shadow. That's the silhouette of the 'attacker' we're going to test. Each card shows status, EVM address, and a live balance."

---

## 3. Beat 1 — list (~15 s)

In the chat input, click the **"List runtimes"** chip.

> "I ask the agent to list the fleet."

The SSE stream paints tokens in real time. Wait for the assistant bubble.

> "Three runtimes. Alpha registered. Beta and gamma carrying revoked status from earlier runs — we'll reset them. The data comes from the operator; **the LLM never touched a private key** in this request."

---

## 4. Beat 2 — rotate alpha (~40 s)

**Click the "Rotate alpha" chip.**

> "Here's the meat. I tell it: **rotate alpha's keys**. This fires a workflow on KeeperHub."

Immediately jump to **Tab 3 (KeeperHub dashboard)**.

> "Look: KeeperHub picked up the trigger and is running the workflow nodes. It generated fresh EOAs, it's funding them with a Base Sepolia faucet, and it's about to distribute them to the runtimes."

Back to **Tab 2 (demo app)** while KH does its thing (~10–30 s).

> "On the canvas: alpha goes from **registered** to **awaiting**. See the cyan dashed line from operator to alpha — that's the data packet riding the handshake. Alpha signs the challenge with its ed25519 private key, identity validates, and it receives the new EVM wallet."

Wait until alpha hits `received`. Then point at the MiniTimeline at the bottom of the canvas:

> "The whole sequence lands in the OPERATOR STREAM and in the mini timeline down here as event chips. The new address shows up on alpha's card, and up in the topbar's ROTATION STATUS you have the deprecation tx hash with a direct basescan link."

Click the tx hash chip if it's visible → opens BaseScan in a new tab.

> "There it is, on-chain: `WalletsDeprecated`, emitted by the FleetRegistry. The rotation closed. The old private key is invalidated in the contract; the new one never went through the LLM."

---

## 5. Beat 3 — simulate a clone attack (~30 s)

Back to the demo tab. **Click the "Simulate clone attack" chip.**

> "Now the scenario that justifies the whole system: **an attacker holding alpha's binary but not its cryptographic identity**. I ask the agent to simulate the attack."

The operator opens a real WebSocket against itself, posing as a fake clone with a random ed25519 pubkey. Watch the canvas:

> "Two things happen. The **GAMMA-CLONE** card flashes destructive red — that's the ghost that represents 'any clone attempt' in this demo. And right next to **alpha**, a translucent silhouette with an X appears — that's the actual attacker the operator detected and rejected. Socket closed with code `4403 pubkey_mismatch`."

Point to the OPERATOR STREAM in the sidebar:

> "The log spells it out: `Clone rejected: alpha presented foreign pubkey; handshake denied`. The defense isn't decorative — the operator checks the presented pubkey against the registered one, and if it doesn't match, no handshake. **No valid signature, no key**, just like the landing said."

---

## 6. Beat 4 — toggle WS ↔ AXL (~20 s, optional)

Only if you have AXL nodes + bridge running.

**Click the "AXL" toggle** in the topbar.

> "Quick demo: the transport. Until now we were on the operator's centralized WebSocket. Click AXL: now the browser is polling a peer-to-peer mesh built on **gensyn-ai/axl**. Same event bus, decentralized transport."

The badge should flip to `VIA AXL` in cyan, and `last event` starts ticking again.

> "The `ITransport` contract makes this possible: any consumer that respects the interface can plug in. This is what makes the system portable to real p2p networks."

Click back to `WS` (the EdgePulse animation reads better on WS thanks to lower latency).

---

## 7. Beat 5 — direct interaction on a card (~15 s)

> "And for the judge who'd rather click than type: every card is interactive."

**Click the ALPHA card** → the floating menu appears.

> "Action menu: rotate, inspect, simulate attack, revoke. Each item fires the agent with the right prompt. Zero typing, same end-to-end path."

Click outside, or hit ESC, to close.

---

## 8. Close + reset (~10 s)

**Click "Reset demo".**

> "Reset wipes everything for the next run — runtimes back to `registered`, mini timeline cleared, wallets unassigned. The operator doesn't need to restart."

Switch back to the **landing tab** (Tab 1) for symmetry.

> "That's Sonar. The LLM sees the system, moves the pieces, but never touches a key. **Identity-checked rotation. End-to-end on Base Sepolia. Built in 5 days.**"

Done.

---

## 9. Recovery plan — when something breaks live

| Symptom | Immediate action |
|---|---|
| Badge shows `OFFLINE` | Verify ngrok is still up (`curl -sS -o /dev/null -w "%{http_code}" https://...ngrok-free.dev/runtimes -H "ngrok-skip-browser-warning: 1"`). If it's dead, restart the tunnel; the badge reconnects on its own in <30s. |
| `Rotate alpha` stuck at `awaiting` >60s | Means the alpha runtime isn't running or isn't acking. Fire another rotation against **beta** or **gamma** while you diagnose. Last resort: `Reset demo` and start fresh. |
| `Simulate clone attack` doesn't flash | The operator isn't on the latest code (commit `cf39652+`). In the operator terminal: confirm it logs `operator_listening port=8787`. If not, restart. |
| KeeperHub workflow returns 5xx | Check that `apps/keeperhub/workflow.json` points at the current ngrok URL. If it changed, run `pnpm --filter @sonar/keeperhub publish:workflow`. |
| Agent token stream hangs | Likely an Anthropic Haiku rate-limit hit. Wait 5s and retry. |
| AXL toggle shows `OFFLINE` after switching | The `scripts/axl-bridge.mjs` bridge crashed. Check the bridge terminal's last log; restart. |

**Golden rule:** if a beat breaks, **keep narrating the next one**. The stack is resilient — the next rotation almost certainly works even if the previous one didn't.

---

## 10. Post-demo (Q&A prep)

Bullets to keep ready in case of questions:

- **Why doesn't the LLM see the private keys?** By construction. Privkeys live in the operator's in-memory `PrivkeyVault` (10-min TTL), they never reach the MCP, they never appear in the agent's SSE stream, they never land in the LogBus. The vault's `toJSON()` throws so any accidental `JSON.stringify` blows up loud.
- **What happens if the operator crashes mid-rotation?** The vault TTL evicts after 10 min. The rotation lands incomplete on-chain (new wallets minted, old ones not yet deprecated). KeeperHub re-fires the workflow when `/rotation/distribute` doesn't return 200.
- **Why AXL?** So we don't have a single centralized WebSocket between the operator and consumers. The `ITransport` interface allows swapping; AXL is the reference p2p implementation. WebSocket stays the default for latency reasons (250 ms vs sub-ms).
- **What about the operator's wallet?** The operator doesn't sign on-chain transactions; KeeperHub does. The operator only orchestrates. The address shown in the `FLEET REGISTRY` chip is the contract, not an EOA.
- **Test coverage.** 259/259 green across shared / keeperhub / demo-ui / runtime / mcp / operator. The agent's 6 tools have unit tests plus end-to-end Playwright smokes.

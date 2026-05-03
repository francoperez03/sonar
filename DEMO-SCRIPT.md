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
- Canvas: sequence row shows `agent asks → KeeperHub workflow → operator verifies → runtime receives → chain deprecates`
- Canvas: one live `OPERATOR` chip, ALPHA registered with a small ETH balance, BETA/GAMMA in any state, GAMMA-CLONE as a ghost
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

> "Sonar rotates keys without showing a private key to the LLM. The main idea is here: **Rotate keys without trusting the agent**."

Slowly scroll to `01 / PROBLEM`.

> "The problem is simple. If an agent has secrets in its context, it can leak them. One bad log line can expose a key. This is the **OWASP LLM06** risk. Sonar avoids that by never giving the LLM the key."

Scroll to `02 / APPROACH`.

> "The approach is: let the LLM coordinate the work, but never touch the secret. It starts the rotation, KeeperHub generates and funds wallets, the operator distributes them, and the old wallet is deprecated on-chain. Before a runtime receives anything, it must sign a challenge. If the signature is not valid, it gets nothing."

Scroll to `03 / SEE IT RUN`. Click **"Open the live demo"**.

---

## 2. First look at the app (~20 s)

**Tab 2 (demo app).** Pause. Walk the eye through the topbar first.

> "At the top, the left badge tells me I am live and connected to the operator over WebSocket. I can also switch to AXL peer-to-peer with one click. On the right, I have the rotation status and the FleetRegistry contract on Base Sepolia. That is where old wallets are deprecated."

Click the `0x7edd…b31f` chip (opens a new tab).

> "Here it is on BaseScan."

Back to the demo tab.

> "In the canvas, the top row is the full path: agent asks, KeeperHub runs the workflow, the operator verifies identity, the runtime receives the wallet, and chain deprecates the old one. The big live chip is the Operator, because that is the identity gate we can see reacting here."

> "Below that, we have three real runtimes: alpha, beta, and gamma. We also have gamma-clone in shadow. That one represents the attacker case. Each card shows status, wallet address, and live balance, even for very small testnet amounts."

---

## 3. Beat 1 — list (~15 s)

In the chat input, click the **"List runtimes"** chip.

> "First, I ask the agent to list the fleet."

The SSE stream paints tokens in real time. Wait for the assistant bubble.

> "The operator returns the runtime list. This is just inspection. The LLM can see the state of the system, but it still never sees a private key."

---

## 4. Beat 2 — rotate alpha (~40 s)

**Click the "Rotate alpha" chip.**

> "Now the important part. I ask it to **rotate alpha's keys**. This starts a KeeperHub workflow."

Immediately jump to **Tab 3 (KeeperHub dashboard)**.

> "KeeperHub received the trigger and is running the workflow. It generates a fresh wallet, funds it on Base Sepolia, and then sends it to the operator for distribution."

Back to **Tab 2 (demo app)** while KH does its thing (~10–30 s).

> "Back in the app, alpha moves from **registered** to **awaiting**. The cyan line shows the operator talking to alpha. Alpha signs a challenge with its identity key. If the signature is valid, alpha receives the new EVM wallet."

Wait until alpha hits `received`. Then point at the MiniTimeline at the bottom of the canvas:

> "The events appear in the operator stream and in the mini timeline. The new wallet appears on alpha's card, with the tiny funded balance visible in ETH decimals. In the topbar, we also get the deprecation transaction hash, with a direct BaseScan link."

Click the tx hash chip if it's visible → opens BaseScan in a new tab.

> "Here is the on-chain proof: `WalletsDeprecated`, emitted by the FleetRegistry. The rotation is complete. The old wallet is deprecated, and the new key never passed through the LLM."

---

## 5. Beat 3 — simulate a clone attack (~30 s)

Back to the demo tab. **Click the "Simulate clone attack" chip.**

> "Now let's test the attack case. Imagine someone copied a runtime binary, but does not have the real cryptographic identity. I ask the agent to simulate that attack."

The operator opens a real WebSocket against itself, posing as a fake clone with a random ed25519 pubkey. Watch the canvas:

> "Two things happen. The **GAMMA-CLONE** card turns red. That is the visual clone attempt. Next to alpha, an attacker silhouette appears with an X. The operator detected it and rejected it. The socket closes with `4403 pubkey_mismatch`."

Point to the OPERATOR STREAM in the sidebar:

> "The log says it clearly: `Clone rejected: alpha presented foreign pubkey; handshake denied`. This is not just UI. The operator checks the public key against the registered identity. If it does not match, there is no handshake and no key is delivered."

---

## 6. Beat 4 — toggle WS ↔ AXL (~20 s, optional)

Only if you have AXL nodes + bridge running.

**Click the "AXL" toggle** in the topbar.

> "Quick transport demo. Until now, the app used the operator WebSocket. If I click AXL, the browser reads events through a peer-to-peer mesh built on **gensyn-ai/axl**. Same events, different transport."

The badge should flip to `VIA AXL` in cyan, and `last event` starts ticking again.

> "This works because everything uses the same `ITransport` interface. So WebSocket and AXL can be swapped without changing the rest of the app."

Click back to `WS` (the EdgePulse animation reads better on WS thanks to lower latency).

---

## 7. Beat 5 — direct interaction on a card (~15 s)

> "Also, if the judge prefers clicking instead of typing, every runtime card is interactive."

**Click the ALPHA card** → the floating menu appears.

> "This menu has rotate, inspect, simulate attack, and revoke. Each action sends the right prompt to the agent. Same flow, no typing needed."

Click outside, or hit ESC, to close.

---

## 8. Close + reset (~10 s)

**Click "Reset demo".**

> "Reset prepares the next run. Runtimes go back to `registered`, the timeline is cleared, and wallets are unassigned. I do not need to restart the operator."

Switch back to the **landing tab** (Tab 1) for symmetry.

> "That's Sonar. The LLM can see the system and coordinate the rotation, but it never touches a key. **Identity-checked rotation, end-to-end on Base Sepolia, built in 5 days.**"

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

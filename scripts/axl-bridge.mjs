#!/usr/bin/env node
// scripts/axl-bridge.mjs — WS → AXL forwarder.
//
// Subscribes to the operator's /logs WebSocket and POSTs each frame to
// AXL Node A's /send endpoint, addressed to Node B's pubkey. Demo-ui
// (when its transport selector is set to AXL) polls /recv on Node B.
//
// Usage (env vars):
//   OPERATOR_WS_URL    default: ws://localhost:8787/logs
//   AXL_SEND_URL       default: http://127.0.0.1:9001/send
//   AXL_DEST_PEER_ID   required — Node B's pubkey hex
//
// Reconnect: on WS close we wait 1s, retry; doubles up to 10s.
//
// Uses Node's built-in `WebSocket` global (Node 21+) so we don't have to
// pull in the workspace `ws` package — keeps this script truly standalone.

const OPERATOR_WS_URL = process.env.OPERATOR_WS_URL ?? "ws://localhost:8787/logs";
const AXL_SEND_URL = process.env.AXL_SEND_URL ?? "http://127.0.0.1:9001/send";
const AXL_DEST_PEER_ID = process.env.AXL_DEST_PEER_ID ?? "";

if (!AXL_DEST_PEER_ID) {
  console.error("axl-bridge: AXL_DEST_PEER_ID is required (Node B pubkey hex)");
  process.exit(1);
}

let backoff = 1000;
let stopped = false;
let forwarded = 0;
let lastLog = Date.now();

function log(obj) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...obj })}\n`);
}

async function forward(buffer) {
  // buffer is whatever the WS sent — string or Buffer/Blob from Node `ws`.
  const body = typeof buffer === "string" ? buffer : Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
  try {
    const r = await fetch(AXL_SEND_URL, {
      method: "POST",
      headers: {
        "X-Destination-Peer-Id": AXL_DEST_PEER_ID,
        "Content-Type": "application/octet-stream",
      },
      body,
    });
    if (!r.ok) {
      log({ msg: "axl_send_non_200", status: r.status });
      return;
    }
    forwarded += 1;
    if (Date.now() - lastLog > 5000) {
      log({ msg: "axl_forward_tick", forwarded, dest: AXL_DEST_PEER_ID.slice(0, 8) + "…" });
      lastLog = Date.now();
    }
  } catch (e) {
    log({ msg: "axl_send_error", err: e instanceof Error ? e.message : String(e) });
  }
}

function connect() {
  if (stopped) return;
  log({ msg: "ws_connect", url: OPERATOR_WS_URL });
  const ws = new WebSocket(OPERATOR_WS_URL);

  ws.addEventListener("open", () => {
    backoff = 1000;
    log({ msg: "ws_open", forwarder: "ready", dest: AXL_DEST_PEER_ID.slice(0, 12) + "…" });
  });

  ws.addEventListener("message", (ev) => {
    void forward(ev.data);
  });

  ws.addEventListener("close", (ev) => {
    log({ msg: "ws_close", code: ev.code, reason: ev.reason ?? "" });
    if (stopped) return;
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 10_000);
  });

  ws.addEventListener("error", () => {
    log({ msg: "ws_error" });
  });
}

process.on("SIGINT", () => {
  stopped = true;
  log({ msg: "shutdown", forwarded });
  process.exit(0);
});

connect();

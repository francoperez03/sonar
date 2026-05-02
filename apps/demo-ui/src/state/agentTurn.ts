import { store } from "./store.js";

/**
 * Driver for a single agent turn over SSE. Mirrors the wire format emitted
 * by apps/operator/src/http/routes/agent/chat.ts:
 *   event: token       data: {type:"token", text}
 *   event: tool_use    data: {type:"tool_use", id, name, input}
 *   event: tool_result data: {type:"tool_result", id, ok, output}
 *   event: done        data: {type:"done", reason, detail?}
 *
 * The browser displays the user prompt + final assistant text via the
 * Operator's WS broadcast (logBus → /logs); this driver only feeds the
 * token-level "draft" assistant bubble for streaming feel.
 */

function operatorHttpUrl(): string {
  const explicit = import.meta.env.VITE_OPERATOR_HTTP_URL;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  // Derive from the WS URL if not set: wss://host/logs → https://host
  const ws = (import.meta.env.VITE_OPERATOR_WS_URL ?? "ws://localhost:8787/logs") as string;
  return ws
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://")
    .replace(/\/logs$/, "");
}

export async function submitAgentPrompt(prompt: string): Promise<void> {
  if (store.getSnapshot().agentBusy) return;
  const text = prompt.trim();
  if (!text) return;

  store.startAgentTurn();
  let res: Response;
  try {
    res = await fetch(`${operatorHttpUrl()}/agent/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify({ prompt: text }),
    });
  } catch {
    store.appendAgentToken("\n[network error: agent unreachable]");
    store.endAgentTurn();
    return;
  }

  if (!res.ok || !res.body) {
    store.appendAgentToken(`\n[agent error ${res.status}]`);
    store.endAgentTurn();
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      // SSE frames are separated by a blank line.
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleFrame(frame);
      }
    }
  } finally {
    store.endAgentTurn();
  }
}

function handleFrame(frame: string): void {
  // Parse one SSE frame: `event: name\ndata: json` (heartbeats start with `:` and are skipped).
  let evtName = "message";
  let dataLine = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) evtName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return;

  let payload: { type?: string; text?: string };
  try {
    payload = JSON.parse(dataLine);
  } catch {
    return;
  }

  if (evtName === "token" && typeof payload.text === "string") {
    store.appendAgentToken(payload.text);
  }
  // tool_use / tool_result are visible already via the canvas + EventLog;
  // we only project token text into the draft bubble. `done` is implicit
  // (loop exits on stream end).
}

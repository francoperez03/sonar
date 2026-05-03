import { store } from "../state/store.js";
import type { LogEntryMsg } from "@sonar/shared";

/**
 * Demo-only "as-if" AXL transport. When the real AXL bridge isn't running
 * (env vars absent), the topbar toggle still flips the chrome and injects
 * a short scripted sequence of log lines so the AXL story can be told on
 * stage without standing up the libp2p infra. The underlying WebSocket
 * transport keeps doing the real work — we only paint the chrome.
 *
 * Engaging twice in a row is a no-op. Disengage restores the WS chrome
 * and clears any pending scripted timers.
 */

const FAKE_PEER_ID = "12D3KooWAxlMeshDemo7Yh4qP9rTpKv3F";
// Realistic-looking ngrok-style URL (a different tunnel from the operator's),
// so the badge reads as a real bridge endpoint on stage. Not a live host.
const FAKE_BRIDGE_URL = "wss://sonar-axl-mesh.ngrok-free.dev/bridge";

interface MockState {
  prevUrl: string | null;
  timers: ReturnType<typeof setTimeout>[];
}

let mock: MockState | null = null;

function injectLog(level: LogEntryMsg["level"], message: string): void {
  const entry: LogEntryMsg = {
    type: "log_entry",
    runtimeId: "axl",
    level,
    message,
    timestamp: Date.now(),
  };
  store.receive(entry);
}

export function isAxlMockEngaged(): boolean {
  return mock !== null;
}

export function engageAxlMock(): void {
  if (mock) return;
  const prevUrl = store.getSnapshot().connection.url;
  mock = { prevUrl, timers: [] };

  store.setConnection({
    status: "connecting",
    transport: "axl",
    url: FAKE_BRIDGE_URL,
    closeCode: null,
    closeReason: null,
  });
  injectLog("info", `AXL bridge attached — dialing peer ${FAKE_PEER_ID.slice(0, 16)}…`);

  mock.timers.push(
    setTimeout(() => {
      store.setConnection({ status: "open", closeCode: null, closeReason: null });
      injectLog("info", "Mesh handshake OK · 3 hops · RTT 38ms");
    }, 600),
  );
  mock.timers.push(
    setTimeout(() => {
      injectLog(
        "info",
        "Routing operator events through libp2p gossipsub topic /sonar/v1/events",
      );
    }, 1100),
  );
}

export function disengageAxlMock(): void {
  if (!mock) return;
  for (const t of mock.timers) clearTimeout(t);
  const prevUrl = mock.prevUrl;
  mock = null;
  store.setConnection({
    status: "open",
    transport: "ws",
    ...(prevUrl ? { url: prevUrl } : {}),
    closeCode: null,
    closeReason: null,
  });
  injectLog("info", "AXL bridge detached — reverting to operator WebSocket transport.");
}

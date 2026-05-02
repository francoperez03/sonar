import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/tokens.css";
import "./styles/demo.css";
import { configureTransport, swapTransport } from "./transport/transportManager.js";
import { store } from "./state/store.js";
import { bootstrapRuntimes } from "./state/bootstrapRuntimes.js";

// Singleton transport at module scope — never inside a useEffect (Pitfall 1, 2, 8).
// The transportManager owns the singleton and lets components swap kinds at
// runtime (WS ↔ AXL). The boot kind is taken from VITE_TRANSPORT (build-time)
// and falls back to WebSocket.
const operatorWsUrl =
  import.meta.env.VITE_OPERATOR_WS_URL ?? "ws://localhost:8080/logs";
const axlBridgeUrl =
  import.meta.env.VITE_AXL_BRIDGE_URL ?? "http://127.0.0.1:9002";
const axlDestPeerId = import.meta.env.VITE_AXL_DEST_PEER_ID ?? "";
const initialKind = import.meta.env.VITE_TRANSPORT === "axl" ? "axl" : "ws";

configureTransport({
  wsUrl: operatorWsUrl,
  axl: {
    bridgeUrl: axlBridgeUrl,
    destPeerId: axlDestPeerId,
    available: Boolean(axlBridgeUrl && axlDestPeerId),
  },
});

void swapTransport(initialKind);
void bootstrapRuntimes();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

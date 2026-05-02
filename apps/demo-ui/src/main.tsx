import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/tokens.css";
import "./styles/demo.css";
import { createBrowserClientTransport } from "./transport/createBrowserClientTransport.js";
import { createAxlClientTransport } from "./transport/createAxlClientTransport.js";
import { store } from "./state/store.js";

// Singleton transport at module scope — never inside a useEffect (Pitfall 1, 2, 8).
// Default transport is WebSocket; opt into AXL with VITE_TRANSPORT=axl when a
// local AXL bridge is running (see apps/demo-ui/README.md and
// docs/decisions/axl-deferred.md is N/A — Branch A landed at 06-06).
const operatorWsUrl =
  import.meta.env.VITE_OPERATOR_WS_URL ?? "ws://localhost:8080/logs";

store.setConnection({ url: operatorWsUrl, status: "connecting" });

const transport =
  import.meta.env.VITE_TRANSPORT === "axl"
    ? createAxlClientTransport({
        bridgeUrl:
          import.meta.env.VITE_AXL_BRIDGE_URL ?? "http://127.0.0.1:9002",
        destPeerId: import.meta.env.VITE_AXL_DEST_PEER_ID ?? "",
      })
    : createBrowserClientTransport({
        url: operatorWsUrl,
        onOpen: () =>
          store.setConnection({
            status: "open",
            url: operatorWsUrl,
            closeCode: null,
            closeReason: null,
          }),
        onClose: (code, reason) =>
          store.setConnection({
            status: "closed",
            closeCode: code,
            closeReason: reason,
          }),
      });
transport.onMessage(store.receive);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/tokens.css";
import "./styles/demo.css";
import { createBrowserClientTransport } from "./transport/createBrowserClientTransport.js";
import { store } from "./state/store.js";

// Singleton transport at module scope — never inside a useEffect (Pitfall 1, 2, 8).
const operatorWsUrl =
  import.meta.env.VITE_OPERATOR_WS_URL ?? "ws://localhost:8080/logs";

const transport = createBrowserClientTransport({ url: operatorWsUrl });
transport.onMessage(store.receive);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

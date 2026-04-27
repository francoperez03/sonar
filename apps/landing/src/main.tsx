import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { reportWebVitals } from "./lib/reportWebVitals";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element missing in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

reportWebVitals();

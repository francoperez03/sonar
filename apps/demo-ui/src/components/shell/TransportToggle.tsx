import { useTransport, useAxlAvailable } from "../../state/hooks.js";
import { swapTransport } from "../../transport/transportManager.js";
import { engageAxlMock, disengageAxlMock } from "../../transport/mockAxlBridge.js";
import type { TransportKind } from "../../state/reducer.js";

const ITEMS: ReadonlyArray<{ kind: TransportKind; label: string; tooltip: string }> = [
  { kind: "ws", label: "WS", tooltip: "Centralized operator WebSocket — default transport." },
  {
    kind: "axl",
    label: "AXL",
    tooltip:
      "Decentralized peer-to-peer transport (gensyn-ai/axl). The same operator events route through the local AXL mesh.",
  },
];

/**
 * Topbar segmented control for swapping the live transport. Always rendered
 * so the AXL story is tellable on stage; when the real bridge isn't running
 * the toggle falls through to a scripted "as-if" mode that flips the chrome
 * and prints a short sequence of routing log lines.
 */
export function TransportToggle(): JSX.Element {
  const active = useTransport();
  const axlAvailable = useAxlAvailable();

  function onSelect(kind: TransportKind): void {
    if (kind === active) return;
    if (axlAvailable) {
      void swapTransport(kind);
      return;
    }
    if (kind === "axl") engageAxlMock();
    else disengageAxlMock();
  }

  return (
    <div
      className="transport-toggle"
      role="radiogroup"
      aria-label="Transport"
      data-testid="transport-toggle"
    >
      {ITEMS.map((item) => {
        const selected = item.kind === active;
        return (
          <button
            key={item.kind}
            type="button"
            role="radio"
            aria-checked={selected}
            title={item.tooltip}
            className={`transport-toggle-button ${selected ? "transport-toggle-button--active" : ""}`}
            onClick={() => onSelect(item.kind)}
            data-testid={`transport-toggle-${item.kind}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

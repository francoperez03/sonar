import { useTransport, useAxlAvailable } from "../../state/hooks.js";
import { swapTransport } from "../../transport/transportManager.js";
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
 * Topbar segmented control for swapping the live transport. Renders only
 * when AXL is configured (env vars present); otherwise the demo silently
 * stays on WebSocket and there's nothing to switch.
 */
export function TransportToggle(): JSX.Element | null {
  const active = useTransport();
  const axlAvailable = useAxlAvailable();
  if (!axlAvailable) return null;

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
            onClick={() => {
              if (!selected) void swapTransport(item.kind);
            }}
            data-testid={`transport-toggle-${item.kind}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

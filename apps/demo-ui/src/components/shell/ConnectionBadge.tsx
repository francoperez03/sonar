import { useEffect, useState } from "react";
import { useConnection } from "../../state/hooks.js";

const LABEL = {
  connecting: "CONNECTING",
  open: "LIVE",
  closed: "OFFLINE",
} as const;

function formatAgo(ms: number): string {
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function ConnectionBadge(): JSX.Element {
  const conn = useConnection();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const lastSeen =
    conn.lastMessageAt != null ? formatAgo(now - conn.lastMessageAt) : "no events yet";
  return (
    <div
      className={`connection-badge connection-badge--${conn.status}`}
      role="status"
      aria-live="polite"
      data-testid="connection-badge"
    >
      <span className="connection-badge-dot" aria-hidden="true" />
      <span className="connection-badge-label">{LABEL[conn.status]}</span>
      {conn.url && (
        <span className="connection-badge-url" title={conn.url}>
          {conn.url.replace(/^wss?:\/\//, "")}
        </span>
      )}
      <span className="connection-badge-meta">· last event {lastSeen}</span>
      {conn.status === "closed" && conn.closeReason && (
        <span className="connection-badge-meta">
          · {conn.closeCode ?? ""} {conn.closeReason}
        </span>
      )}
    </div>
  );
}

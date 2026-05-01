import { useEffect, useState } from "react";

/**
 * useRelativeTime — ported from foja's apps/demo/src/components/sidebar/EventLog.tsx
 * (lines 150-162). Returns "now" / "+5s" / "+1m" / "+1h" relative to `timestamp`,
 * refreshing every 5s so old entries decay naturally.
 */
export function useRelativeTime(timestamp: number): string {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return (): void => window.clearInterval(id);
  }, []);
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 5) return "now";
  if (diffSec < 60) return `+${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `+${diffMin}m`;
  return `+${Math.floor(diffMin / 60)}h`;
}

import { useEffect, useState } from "react";
import { useEvents } from "../../state/hooks.js";
import type { EventRow } from "../../state/reducer.js";

/**
 * Horizontal "filmstrip" of the last few operator events. Different from
 * EventLog (textual list): each tick is a single chip with runtime avatar,
 * an icon for the event kind (info/warn), and a relative timestamp. Sits
 * at the bottom of the canvas so the visual story (cards above) and the
 * trail of evidence (chips below) live in one frame.
 */

const MAX = 7;

const KIND_GLYPH: Record<string, string> = {
  info: '·',
  warn: '!',
  error: '×',
  debug: '~',
};

function colorFor(level: string): string {
  if (level === 'warn') return 'rgba(224, 122, 122, 0.85)';
  if (level === 'error') return 'rgba(224, 122, 122, 0.95)';
  return 'var(--color-accent-cyan)';
}

function ago(ms: number, now: number): string {
  const diff = now - ms;
  if (diff < 1000) return 'now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function MiniTimeline(): JSX.Element | null {
  const events = useEvents();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const latest: EventRow[] = events.slice(-MAX);
  if (latest.length === 0) return null;
  return (
    <div className="mini-timeline" aria-label="Recent events" data-testid="mini-timeline">
      {latest.map((e) => (
        <div key={e.id} className="mini-timeline-chip" title={e.message}>
          <span
            className="mini-timeline-glyph"
            style={{ color: colorFor(e.kind) }}
            aria-hidden="true"
          >
            {KIND_GLYPH[e.kind] ?? '·'}
          </span>
          <span className="mini-timeline-runtime">{e.runtimeId ?? '—'}</span>
          <span className="mini-timeline-ago">{ago(e.timestamp, now)}</span>
        </div>
      ))}
    </div>
  );
}

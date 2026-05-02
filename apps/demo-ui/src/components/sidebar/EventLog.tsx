import { Virtuoso } from 'react-virtuoso';
import { useEvents } from '../../state/hooks.js';
import type { EventRow } from '../../state/reducer.js';
import { useRelativeTime } from '../../util/relativeTime.js';

/**
 * EventLog — live operator/runtime event stream (DEMO-02). Reads useEvents()
 * and filters out `kind === 'chat'` defensively (D-07: chat is owned by
 * ChatMirror; the reducer never adds chat to events, so this filter is a
 * belt-and-suspenders invariant guard).
 *
 * RESEARCH Pitfall 3: followOutput="auto" (snap) for rapid bursts (handshake
 * replay, clone-rejection cascade). ChatMirror uses "smooth".
 *
 * RESEARCH Pattern 4: react-virtuoso's followOutput is the autoscroll-on-tail
 * primitive — it only autoscrolls when the user is at/near bottom
 * (atBottomThreshold=48), so a user reading old entries is not yanked.
 *
 * Accent eyebrow: status-milestone events ("received", "deprecated") get the
 * accent-cyan eyebrow per UI-SPEC §EventLog row contract. The plan calls this
 * "status_change to received" but the on-wire status_change message kind does
 * not enter state.events (the reducer routes those to runtimes); we therefore
 * detect milestones by message-text keyword, which matches the visible UX.
 */
export function EventLog(): JSX.Element {
  const all = useEvents();
  const events = all.filter((e) => e.kind !== 'chat');

  if (events.length === 0) {
    return (
      <div className="event-log-empty" aria-live="polite">
        <div className="event-log-empty-heading">Stream armed</div>
        <p className="event-log-empty-body">Rotation events will stream here.</p>
      </div>
    );
  }

  return (
    <Virtuoso
      style={{ height: 240 }}
      data={events}
      followOutput="auto"
      atBottomThreshold={48}
      initialItemCount={events.length}
      itemContent={(_index, ev): JSX.Element => <EventRowItem row={ev} />}
      aria-live="polite"
    />
  );
}

const ACCENT_RE = /\b(received|deprecated)\b/i;

function EventRowItem({ row }: { row: EventRow }): JSX.Element {
  const rel = useRelativeTime(row.timestamp);
  const accent = ACCENT_RE.test(row.message);
  return (
    <div className="event-row">
      <span className="event-row-ts">{rel}</span>
      <span className="event-row-runtime">{row.runtimeId ?? 'system'}</span>
      <span className={`event-row-kind${accent ? ' is-accent' : ''}`}>
        {row.kind.toUpperCase()}
      </span>
      <span className="event-row-body">{row.message}</span>
    </div>
  );
}

import { useRelativeTime } from "../../util/relativeTime.js";

/**
 * IdentityStrip — truncated 4..4 pubkey + relative-time timestamp
 * (UI-SPEC §Component Inventory line 178, CONTEXT D-10). Uses em-dash
 * when the pubkey hasn't been registered yet, and hides the timestamp
 * when the runtime hasn't emitted any event.
 */
export function IdentityStrip({
  pubkey,
  lastEventAt,
}: {
  pubkey: string | null;
  lastEventAt: number | null;
}): JSX.Element {
  const truncated = pubkey ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}` : "—";
  const rel = useRelativeTime(lastEventAt ?? 0);
  return (
    <div className="identity-strip">
      <span className="identity-strip-key" data-testid="identity-strip-key">
        {truncated}
      </span>
      {lastEventAt != null && <span className="identity-strip-ts">{rel}</span>}
    </div>
  );
}

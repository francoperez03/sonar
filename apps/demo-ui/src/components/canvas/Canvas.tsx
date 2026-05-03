import { useEffect, useState } from 'react';
import { useRuntimes } from '../../state/hooks.js';
import type { RuntimeId } from '../../state/reducer.js';
import { RuntimeNode } from './RuntimeNode.js';
import { ServiceNode } from './ServiceNode.js';
import { EdgePulse } from './EdgePulse.js';
import { MiniTimeline } from './MiniTimeline.js';

/**
 * Canvas — the visual hero of the demo (DEMO-03). Renders:
 *   - 1 service chip anchored left: OPERATOR (the live identity gate)
 *   - A compact path strip to its right for the rest of the rotation flow
 *   - 4 runtime nodes in a row underneath: alpha, beta, gamma, gamma-clone
 *     (gamma-clone visually offset to the right per UI-SPEC §Canvas)
 *   - An SVG overlay with EdgePulse paths from Operator → each runtime,
 *     active when that runtime's status is 'awaiting' or 'received' and
 *     a state event landed within the last 1500ms (heuristic per CONTEXT
 *     "Claude's discretion").
 *
 * Idle hint copy per UI-SPEC §Copywriting Contract is shown only when all
 * 4 runtimes are still in 'registered'.
 */

const RUNTIME_ORDER: RuntimeId[] = ['alpha', 'beta', 'gamma', 'gamma-clone'];

// Canvas geometry (Claude's discretion per CONTEXT). viewBox 0 0 800 480.
// Operator anchored at (400, 60); runtimes spread along y=380. Soft cubic
// curves from operator to each of the 4 runtimes.
const PATHS: Record<string, string> = {
  'operator-alpha': 'M 400 60 Q 200 240 120 380',
  'operator-beta': 'M 400 60 Q 360 240 320 380',
  'operator-gamma': 'M 400 60 Q 480 240 520 380',
  'operator-gamma-clone': 'M 400 60 Q 700 240 720 380',
};

export function Canvas(): JSX.Element {
  const runtimes = useRuntimes();
  const allRegistered = RUNTIME_ORDER.every((id) => runtimes[id].status === 'registered');
  // Re-render every 1s so operator activity decay is smooth.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isActiveEdge = (rid: RuntimeId): boolean => {
    const r = runtimes[rid];
    return (
      (r.status === 'awaiting' || r.status === 'received') &&
      r.lastEventAt != null &&
      now - r.lastEventAt < 1500
    );
  };

  // Operator is the visible system receiving live runtime events in this UI.
  const recent = (ts: number | null, windowMs: number): boolean =>
    ts != null && now - ts < windowMs;
  const operatorActive = RUNTIME_ORDER.some((rid) => recent(runtimes[rid].lastEventAt, 2500));

  return (
    <section className="demo-canvas" aria-label="Canvas">
      <div className="demo-canvas-header">
        <div>
          <div className="demo-eyebrow">KEY ROTATION PATH</div>
          <h1 className="demo-canvas-title">
            Sonar coordinates the key swap without seeing the key.
          </h1>
        </div>
      </div>
      <div className="demo-canvas-services">
        <ServiceNode id="operator" active={operatorActive} />
        <div className="demo-canvas-sequence" aria-label="Rotation sequence">
          <span>agent asks</span>
          <span>KeeperHub workflow</span>
          <span>runtime receives</span>
          <span>chain deprecates</span>
        </div>
      </div>
      <svg
        className="demo-canvas-edges"
        viewBox="0 0 800 480"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {RUNTIME_ORDER.map((rid) => (
          <EdgePulse
            key={`operator-${rid}`}
            d={PATHS[`operator-${rid}`]!}
            active={isActiveEdge(rid)}
          />
        ))}
      </svg>
      <div className="demo-canvas-runtimes">
        {RUNTIME_ORDER.map((rid) => (
          <RuntimeNode key={rid} runtime={runtimes[rid]} />
        ))}
      </div>
      {allRegistered && (
        <div className="demo-canvas-idle">
          Standing by: alpha, beta, and gamma are legitimate runtimes; gamma-clone is staged as the
          rejected edge case.
        </div>
      )}
      <MiniTimeline />
    </section>
  );
}

import { useEffect, useState } from 'react';
import {
  useRuntimes,
  useAgentBusy,
  useLastDeprecation,
} from '../../state/hooks.js';
import type { RuntimeId } from '../../state/reducer.js';
import { RuntimeNode } from './RuntimeNode.js';
import { MiniTimeline } from './MiniTimeline.js';
import { SequenceStep } from './SequenceStep.js';

/**
 * Canvas — the visual hero of the demo (DEMO-03). Renders:
 *   - 1 service chip anchored left: OPERATOR (the live identity gate)
 *   - A compact path strip to its right for the rest of the rotation flow
 *   - 4 runtime nodes in a row underneath: alpha, beta, gamma, alpha-clone
 *     (alpha-clone visually offset to the right per UI-SPEC §Canvas)
 *
 * Idle hint copy per UI-SPEC §Copywriting Contract is shown only when all
 * 4 runtimes are still in 'registered'.
 */

const RUNTIME_ORDER: RuntimeId[] = ['alpha', 'beta', 'gamma', 'alpha-clone'];

export function Canvas(): JSX.Element {
  const runtimes = useRuntimes();
  const allRegistered = RUNTIME_ORDER.every((id) => runtimes[id].status === 'registered');
  // Re-render every 1s so operator activity decay is smooth.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Operator is the visible system receiving live runtime events in this UI.
  const recent = (ts: number | null, windowMs: number): boolean =>
    ts != null && now - ts < windowMs;
  const operatorActive = RUNTIME_ORDER.some((rid) => recent(runtimes[rid].lastEventAt, 2500));

  // Sequence-step state (the four chips next to OPERATOR). Each chip is
  // "active" when the corresponding stage of a rotation just happened, so
  // viewers can read where in the flow we are at any instant.
  const agentBusy = useAgentBusy();
  const lastDeprecation = useLastDeprecation();
  const anyAwaiting = RUNTIME_ORDER.some(
    (rid) => runtimes[rid].status === 'awaiting' && recent(runtimes[rid].lastEventAt, 3000),
  );
  const anyReceivedRecent = RUNTIME_ORDER.some(
    (rid) => runtimes[rid].status === 'received' && recent(runtimes[rid].lastEventAt, 3000),
  );
  const sequence: ReadonlyArray<{
    id: string;
    label: string;
    active: boolean;
    idleHint: string;
    primary?: boolean;
  }> = [
    {
      id: 'operator',
      label: 'OPERATOR',
      active: operatorActive,
      idleHint: 'awaiting runtime event',
      primary: true,
    },
    { id: 'agent-asks', label: 'agent asks', active: agentBusy, idleHint: 'idle' },
    {
      id: 'keeperhub',
      label: 'KeeperHub workflow',
      active: anyAwaiting || anyReceivedRecent,
      idleHint: 'idle',
    },
    {
      id: 'runtime-receives',
      label: 'runtime receives',
      active: anyReceivedRecent,
      idleHint: 'idle',
    },
    {
      id: 'chain-deprecates',
      label: 'chain deprecates',
      active: recent(lastDeprecation?.timestamp ?? null, 6000),
      idleHint: lastDeprecation ? 'last tx settled' : 'idle',
    },
  ];

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
      <div className="demo-canvas-sequence" aria-label="Rotation sequence">
        {sequence.map((step) => (
          <SequenceStep
            key={step.id}
            id={step.id}
            label={step.label}
            active={step.active}
            idleHint={step.idleHint}
            primary={step.primary}
          />
        ))}
      </div>
      <div className="demo-canvas-runtimes">
        {RUNTIME_ORDER.map((rid) => (
          <RuntimeNode key={rid} runtime={runtimes[rid]} />
        ))}
      </div>
      {allRegistered && (
        <div className="demo-canvas-idle">
          Standing by: alpha, beta, and gamma are legitimate runtimes; alpha-clone is staged as the
          rejected edge case.
        </div>
      )}
      <MiniTimeline />
    </section>
  );
}

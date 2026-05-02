import { useLastDeprecation, useRotationInFlight } from '../../state/hooks.js';
import { TxHashChip } from '../primitives/TxHashChip.js';

/**
 * Footer — bottom operation strip. Shows rotation readiness plus the latest
 * on-chain deprecation hash when the Operator observes WalletsDeprecated.
 *
 * In-flight gating ("Rotation in flight…" disabled label per UI-SPEC line 217)
 * is deferred — there is no `runInFlight` selector at this point in Phase 6,
 * and computing it from `runtimes` having any awaiting/received status is
 * left as a Phase 6 plan-06 wiring concern (executor discretion per the plan).
 */
export function Footer(): JSX.Element {
  const dep = useLastDeprecation();
  const rotationInFlight = useRotationInFlight();
  return (
    <footer className="demo-footer" aria-label="Demo controls">
      <div className="demo-footer-left">
        <div className="demo-footer-status">
          <span
            className={`demo-footer-led${rotationInFlight ? ' is-active' : ''}`}
            aria-hidden="true"
          />
          <span>{rotationInFlight ? 'Rotation in flight' : 'Ready for rotation'}</span>
        </div>
        <div>
          <div className="demo-eyebrow">LAST DEPRECATION</div>
          {dep ? (
            <TxHashChip hash={dep.hash} />
          ) : (
            <span className="demo-text-muted">No on-chain deprecation yet</span>
          )}
        </div>
      </div>
    </footer>
  );
}

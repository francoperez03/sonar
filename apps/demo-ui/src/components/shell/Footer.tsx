import { useLastDeprecation } from "../../state/hooks.js";
import { TxHashChip } from "../primitives/TxHashChip.js";

/**
 * Footer — bottom of the demo shell. Left: LAST DEPRECATION eyebrow + TxHashChip
 * (or empty-state copy). Right: Run again CTA.
 *
 * In-flight gating ("Rotation in flight…" disabled label per UI-SPEC line 217)
 * is deferred — there is no `runInFlight` selector at this point in Phase 6,
 * and computing it from `runtimes` having any awaiting/received status is
 * left as a Phase 6 plan-06 wiring concern (executor discretion per the plan).
 */
export function Footer(): JSX.Element {
  const dep = useLastDeprecation();
  return (
    <footer className="demo-footer" aria-label="Demo controls">
      <div className="demo-footer-left">
        <div className="demo-eyebrow">LAST DEPRECATION</div>
        {dep ? (
          <TxHashChip hash={dep.hash} />
        ) : (
          <span className="demo-text-muted">No on-chain deprecation yet</span>
        )}
      </div>
      <button type="button" className="cta-primary" data-testid="run-again">
        Run again
      </button>
    </footer>
  );
}

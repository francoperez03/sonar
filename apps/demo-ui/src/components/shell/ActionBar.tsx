import { useLastDeprecation, useRotationInFlight } from "../../state/hooks.js";
import { TxHashChip } from "../primitives/TxHashChip.js";
import { ChatInput } from "../sidebar/ChatInput.js";

/**
 * ActionBar — bottom command surface. Hosts the prompt input (suggestions
 * + textarea) and a compact rotation-status block on the right showing the
 * latest on-chain deprecation tx hash when present.
 *
 * Replaces the old <Footer/> standalone strip — same data points, but kept
 * within reach of the prompt so the user can act and observe in the same
 * field of view.
 */
export function ActionBar(): JSX.Element {
  const dep = useLastDeprecation();
  const rotationInFlight = useRotationInFlight();
  return (
    <section className="demo-actionbar" aria-label="Command bar">
      <div className="demo-actionbar-prompt">
        <ChatInput />
      </div>
      <aside className="demo-actionbar-rotation" aria-label="Rotation status">
        <div className="demo-actionbar-rotation-row">
          <span
            className={`demo-footer-led${rotationInFlight ? " is-active" : ""}`}
            aria-hidden="true"
          />
          <span className="demo-actionbar-rotation-label">
            {rotationInFlight ? "Rotation in flight" : "Ready for rotation"}
          </span>
        </div>
        {dep && (
          <div className="demo-actionbar-rotation-row">
            <span className="demo-eyebrow demo-actionbar-rotation-eyebrow">
              LAST DEPRECATION
            </span>
            <TxHashChip hash={dep.hash} />
          </div>
        )}
      </aside>
    </section>
  );
}

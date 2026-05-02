import { useLastDeprecation, useRotationInFlight } from "../../state/hooks.js";
import { TxHashChip } from "../primitives/TxHashChip.js";

/**
 * RotationStatus — compact LED + label + (optional) tx-hash chip rendered in
 * the topbar to the right of the connection badge & transport toggle. Lives
 * with the other "system status" indicators so the eye finds them in one
 * row instead of scanning a separate footer.
 */
export function RotationStatus(): JSX.Element {
  const dep = useLastDeprecation();
  const rotationInFlight = useRotationInFlight();
  return (
    <div className="rotation-status" data-testid="rotation-status">
      <span
        className={`rotation-status-led${rotationInFlight ? " is-active" : ""}`}
        aria-hidden="true"
      />
      <span className="rotation-status-label">
        {rotationInFlight ? "ROTATION IN FLIGHT" : "READY"}
      </span>
      {dep && (
        <span className="rotation-status-tx" aria-label="Last deprecation">
          <TxHashChip hash={dep.hash} />
        </span>
      )}
    </div>
  );
}

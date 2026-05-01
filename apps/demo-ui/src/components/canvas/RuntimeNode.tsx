import { motion } from "framer-motion";
import type { RuntimeView } from "../../state/reducer.js";
import { StatusPill } from "../primitives/StatusPill.js";
import { IdentityStrip } from "../primitives/IdentityStrip.js";

/**
 * RuntimeNode — visual card for a single runtime (alpha/beta/gamma/gamma-clone).
 * Composes:
 *   - <StatusPill> (6-state pill)
 *   - <IdentityStrip> (4..4 pubkey + relative timestamp)
 *
 * gamma-clone is the cinematic ghost (CONTEXT D-11): desaturated at idle,
 * destructive flash on `clone-rejected` (CSS keyframes in demo.css).
 *
 * Layout transitions use framer-motion's `layout` prop with the
 * Motion Contract's standard ease + duration.base.
 */
export function RuntimeNode({ runtime }: { runtime: RuntimeView }): JSX.Element {
  const isGhost = runtime.id === "gamma-clone";
  const cls =
    `runtime-node runtime-node--${runtime.status} runtime-node--${runtime.id}` +
    (isGhost ? " runtime-node--ghost" : "");
  return (
    <motion.div
      className={cls}
      data-testid={`runtime-node-${runtime.id}`}
      layout
      transition={{ layout: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] } }}
    >
      <div className="runtime-node-name">{runtime.id.toUpperCase()}</div>
      <StatusPill status={runtime.status} />
      <IdentityStrip pubkey={runtime.pubkey} lastEventAt={runtime.lastEventAt} />
    </motion.div>
  );
}

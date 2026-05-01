import { motion, AnimatePresence } from "framer-motion";

/**
 * EdgePulse — animated cyan SVG path between a service and a runtime
 * (CONTEXT D-12, RESEARCH §Pattern 5). When `active` is true, the path
 * draws from 0 to 1 (`pathLength`) with an opacity envelope, then exits.
 *
 * Motion contract: duration.slow (600ms) + ease.emphasized
 * (cubic-bezier(0.16,1,0.3,1)). prefers-reduced-motion is handled at the
 * CSS layer (.demo-canvas-edges opacity floor).
 */
export function EdgePulse({ d, active }: { d: string; active: boolean }): JSX.Element {
  return (
    <AnimatePresence>
      {active && (
        <motion.path
          d={d}
          stroke="var(--color-accent-cyan)"
          strokeWidth={2}
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </AnimatePresence>
  );
}

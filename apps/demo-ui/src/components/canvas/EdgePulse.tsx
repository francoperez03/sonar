import { motion, AnimatePresence } from "framer-motion";

/**
 * EdgePulse — cyan path from a service to a runtime, with a small "data
 * packet" diamond travelling along the path during an active rotation.
 *
 * The static stroke draws in (pathLength 0→1) on entry; the packet then
 * slides from start to end using framer-motion's `offsetDistance`
 * along the same path (the packet's parent <g> uses `offsetPath`).
 *
 * Motion contract: duration.slow (600ms) + ease.emphasized
 * (cubic-bezier(0.16,1,0.3,1)). prefers-reduced-motion → CSS layer
 * collapses the packet (.demo-canvas-edges opacity floor).
 */
export function EdgePulse({ d, active }: { d: string; active: boolean }): JSX.Element {
  // offset-path uses the same SVG path "d" string.
  const offsetPath = `path('${d}')`;
  return (
    <AnimatePresence>
      {active && (
        <g key="edge">
          <motion.path
            d={d}
            stroke="var(--color-accent-cyan)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 0.9, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.g
            initial={{ offsetDistance: '0%', opacity: 0 } as never}
            animate={{ offsetDistance: '100%', opacity: [0, 1, 1, 0] } as never}
            exit={{ opacity: 0 } as never}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], times: [0, 0.15, 0.85, 1] }}
            style={{ offsetPath, offsetRotate: '0deg' } as never}
          >
            <circle r={5} fill="var(--color-accent-cyan)" opacity={0.95} />
            <circle r={10} fill="var(--color-accent-cyan)" opacity={0.18} />
          </motion.g>
        </g>
      )}
    </AnimatePresence>
  );
}

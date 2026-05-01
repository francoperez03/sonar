import { AnimatePresence, motion } from "framer-motion";
import type { RuntimeStatus } from "../../state/reducer.js";

/**
 * StatusPill — single source of truth for the 6 visual status states
 * (UI-SPEC §Status Pill State Map):
 *   registered | awaiting | received | deprecated | revoked | clone-rejected
 *
 * Wraps the label in <AnimatePresence mode="wait"> so transitions cross-fade
 * per the Motion Contract:
 *   duration.base = 280ms, ease.standard = cubic-bezier(0.2,0.8,0.2,1).
 *
 * The lowercase status word is rendered verbatim (UI-SPEC §Copywriting
 * Contract). prefers-reduced-motion is enforced at the CSS layer
 * (clone-flash keyframes opt out via @media query in demo.css).
 */
export function StatusPill({ status }: { status: RuntimeStatus }): JSX.Element {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        className={`status-pill status-pill--${status}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {status}
      </motion.span>
    </AnimatePresence>
  );
}

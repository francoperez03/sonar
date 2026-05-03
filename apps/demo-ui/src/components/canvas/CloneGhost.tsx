import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Translucent "intruder" silhouette that slides in beside a runtime card
 * when the operator emits a Clone rejected event for that runtimeId, then
 * fades out after ~1.5s. Visualises the rejected attempt without changing
 * the legitimate runtime's status.
 */
export function CloneGhost({ attackedAt }: { attackedAt: number | null }): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!attackedAt) return;
    const age = Date.now() - attackedAt;
    if (age > 1500) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1500 - age);
    return () => clearTimeout(t);
  }, [attackedAt]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="clone-ghost"
          initial={{ opacity: 0, x: -16, filter: 'blur(4px)' }}
          animate={{ opacity: [0, 0.85, 0.55, 0], x: [-16, 6, 6, 18], filter: 'blur(0px)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, times: [0, 0.25, 0.65, 1], ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <div className="clone-ghost-label">CLONE</div>
          <div className="clone-ghost-x">×</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

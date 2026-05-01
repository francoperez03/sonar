import { motion, useReducedMotion } from "framer-motion";
import { type CSSProperties } from "react";

/**
 * AmbientBackground — ported from foja's apps/demo/src/components/shell/AmbientBackground.tsx
 * but using framer-motion directly (rather than foja's CSS keyframes) so the
 * `prefers-reduced-motion: reduce` guard collapses motion to opacity-only fades.
 *
 * Layer chrome: position:fixed, inset:0, z-index:0, pointer-events:none.
 * Decorative — aria-hidden so screen readers ignore it.
 */
type Firefly = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly twinkleDur: number;
  readonly twinkleDelay: number;
  readonly driftDur: number;
  readonly driftDelay: number;
};

// 12 hand-placed offsets from 50%/50% — toned-down vs the landing's 34.
const FIREFLIES: readonly Firefly[] = [
  { x: -460, y: -280, size: 4, twinkleDur: 5.2, twinkleDelay: -0.4, driftDur: 14, driftDelay: 0.0 },
  { x: 520, y: -220, size: 3, twinkleDur: 6.4, twinkleDelay: -2.8, driftDur: 16, driftDelay: 1.6 },
  { x: -380, y: 260, size: 5, twinkleDur: 4.6, twinkleDelay: -1.2, driftDur: 18, driftDelay: 3.2 },
  { x: 560, y: 300, size: 3, twinkleDur: 7.0, twinkleDelay: -3.5, driftDur: 13, driftDelay: 4.8 },
  { x: -140, y: -360, size: 3, twinkleDur: 5.8, twinkleDelay: -2.2, driftDur: 15, driftDelay: 2.4 },
  { x: 180, y: 380, size: 4, twinkleDur: 4.2, twinkleDelay: -0.9, driftDur: 17, driftDelay: 0.8 },
  { x: 620, y: 0, size: 3, twinkleDur: 6.6, twinkleDelay: -4.0, driftDur: 12, driftDelay: 5.4 },
  { x: -580, y: 60, size: 4, twinkleDur: 4.8, twinkleDelay: -1.6, driftDur: 16, driftDelay: 3.6 },
  { x: -40, y: 120, size: 3, twinkleDur: 6.0, twinkleDelay: -2.5, driftDur: 14, driftDelay: 1.2 },
  { x: 260, y: -140, size: 4, twinkleDur: 5.4, twinkleDelay: -3.1, driftDur: 15, driftDelay: 4.0 },
  { x: -260, y: -40, size: 3, twinkleDur: 7.2, twinkleDelay: -0.7, driftDur: 18, driftDelay: 2.0 },
  { x: 420, y: 180, size: 4, twinkleDur: 5.0, twinkleDelay: -2.0, driftDur: 13, driftDelay: 5.0 },
];

function fireflyStyle(f: Firefly): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${f.size}px`,
    height: `${f.size}px`,
    borderRadius: "50%",
    transform: `translate(${f.x}px, ${f.y}px)`,
    background: "var(--color-accent-cyan-glow)",
    boxShadow: "0 0 8px var(--color-accent-cyan-glow)",
  };
}

export function AmbientBackground(): JSX.Element {
  // prefers-reduced-motion: reduce — collapse to a static, low-opacity layer.
  // (The guard MUST live in code; CSS-only fallback in tokens.css is also documented in UI-SPEC.)
  const reduced = useReducedMotion();

  return (
    <div className="sonar-ambient" aria-hidden="true">
      {FIREFLIES.map((f, i) =>
        reduced ? (
          <span key={i} className="sonar-ambient-dot" style={fireflyStyle(f)} />
        ) : (
          <motion.span
            key={i}
            className="sonar-ambient-dot"
            style={fireflyStyle(f)}
            animate={{
              opacity: [0.2, 0.9, 0.2],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: f.twinkleDur,
              delay: f.twinkleDelay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ),
      )}
    </div>
  );
}

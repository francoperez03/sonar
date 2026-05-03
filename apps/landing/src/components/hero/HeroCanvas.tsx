import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useEffect, useState } from "react";
import { PingScene } from "./PingScene";
import { NODES, OUTGOING_END, type NodeId } from "./nodes";
import { NodeBadge } from "../badges/NodeBadge";
import { HeroFallback } from "./HeroFallback";
import styles from "./HeroCanvas.module.css";

const NODE_FLASH_SECONDS = 0.6;

function getActiveBubbleIds(t: number): string {
  return NODES
    .filter((n) => {
      const sinceHit = t - n.hitAt * OUTGOING_END;
      return sinceHit >= 0 && sinceHit < NODE_FLASH_SECONDS;
    })
    .map((n) => n.id)
    .join("|");
}

/**
 * Lazy-loaded R3F Canvas hosting the autonomous ping/echo loop and the
 * three NodeBadge DOM overlays. Default-export so React.lazy can import
 * it from Hero.tsx (set up in plan 01).
 *
 * Reduced-motion guard (RESEARCH §Pitfall 3): when the user prefers
 * reduced motion we short-circuit to the static SVG silhouette — no
 * animation, no Canvas mount. We render <HeroFallback /> directly
 * (rather than returning null) because the Suspense fallback only
 * renders while the lazy promise is pending; once it resolves, an
 * empty return would leave the slot blank.
 */
export default function HeroCanvas() {
  const [activeBubbleIds, setActiveBubbleIds] = useState("");

  useEffect(() => {
    let raf = 0;
    let prev = "";

    const tick = () => {
      const t = (window as unknown as { __pingT?: number }).__pingT;
      if (typeof t === "number") {
        const next = getActiveBubbleIds(t);
        if (next !== prev) {
          prev = next;
          setActiveBubbleIds(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return <HeroFallback />;
  }

  const activeBubbles = new Set(activeBubbleIds.split("|").filter(Boolean) as NodeId[]);

  return (
    <div className={styles.canvasRoot}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <OrthographicCamera
          makeDefault
          position={[0, 4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={120}
        />
        <ambientLight intensity={0.6} />
        <PingScene />
      </Canvas>
      {NODES.map((n) => (
        <div key={n.id}>
          <NodeBadge
            label={n.id}
            style={{ left: n.overlay.left, top: n.overlay.top }}
          />
          <span
            className={`${styles.speechBubble} ${styles.nodeBubble} ${
              activeBubbles.has(n.id) ? styles.nodeBubbleActive : ""
            }`}
            style={{
              left: n.overlay.left,
              top: n.overlay.top,
            }}
            aria-hidden="true"
          >
            Rotate!
          </span>
        </div>
      ))}
      <span
        className={`${styles.speechBubble} ${styles.centerBubble}`}
        aria-label="Central node says Rotate!"
      >
        Rotate!
      </span>
    </div>
  );
}

import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { PingScene } from "./PingScene";
import { NODES } from "./nodes";
import { NodeBadge } from "../badges/NodeBadge";
import { HeroFallback } from "./HeroFallback";
import styles from "./HeroCanvas.module.css";

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
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return <HeroFallback />;
  }

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
        <NodeBadge
          key={n.id}
          label={n.id}
          style={{ left: n.overlay.left, top: n.overlay.top }}
        />
      ))}
    </div>
  );
}

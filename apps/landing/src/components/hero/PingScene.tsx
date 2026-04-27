import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { color } from "../../styles/tokens";
import { NODES, LOOP_SECONDS, OUTGOING_END, ECHO_END } from "./nodes";
import { Node } from "./Node";

/**
 * Autonomous ping/echo loop (RESEARCH §Pattern 3, verbatim timing):
 *   t in [0, OUTGOING_END):  cyan→blue ring expands outward, opacity fades.
 *   t in [OUTGOING_END, ECHO_END):  off-white echo softens back inward.
 *   t in [ECHO_END, LOOP_SECONDS): settle (no draw).
 *
 * Each node pulses (scale + color flash to cyan) when the outgoing ring
 * reaches its `hitAt` fraction (D-02 — runtimes light up on contact).
 *
 * THREE.Color instances are pre-allocated outside useFrame to avoid GC
 * pressure inside the per-frame hot path.
 */
export function PingScene() {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const nodeRefs = useRef<Array<THREE.Mesh | null>>([]);

  const cyanCol = useMemo(() => new THREE.Color(color.accentCyan), []);
  const blueCol = useMemo(() => new THREE.Color(color.accentBlue), []);
  const echoCol = useMemo(() => new THREE.Color(color.accentEcho), []);
  const surfaceCol = useMemo(() => new THREE.Color(color.surface), []);
  const lerpScratch = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime % LOOP_SECONDS;
    const ring = ringRef.current;
    const ringMat = ringMatRef.current;
    // Probe hooks for the Playwright animation-liveness assertion. Headless
    // WebGL framebuffer readback (toDataURL/screenshot) is unreliable across
    // platforms; exposing the per-frame counter + loop time on `window` lets
    // the e2e suite prove the autonomous loop is actually advancing.
    if (typeof window !== "undefined") {
      const w = window as unknown as {
        __pingFrames?: number;
        __pingT?: number;
      };
      w.__pingFrames = (w.__pingFrames ?? 0) + 1;
      w.__pingT = t;
    }
    if (!ring || !ringMat) return;

    if (t < OUTGOING_END) {
      const p = t / OUTGOING_END;
      ring.scale.setScalar(0.1 + p * 2.4);
      ringMat.opacity = 1 - p * 0.5;
      lerpScratch.copy(cyanCol).lerp(blueCol, p);
      ringMat.color.copy(lerpScratch);
    } else if (t < ECHO_END) {
      const p = (t - OUTGOING_END) / (ECHO_END - OUTGOING_END);
      ringMat.color.copy(echoCol);
      ringMat.opacity = 0.4 * (1 - p);
      ring.scale.setScalar(2.5 - p * 0.4);
    } else {
      ringMat.opacity = 0;
    }

    // Node pulses on hit (200ms attack, 400ms decay).
    NODES.forEach((n, i) => {
      const node = nodeRefs.current[i];
      if (!node) return;
      const hitAt = n.hitAt * OUTGOING_END;
      const since = t - hitAt;
      const mat = node.material as THREE.MeshBasicMaterial;
      if (since >= 0 && since < 0.6) {
        const flash = since < 0.2 ? since / 0.2 : 1 - (since - 0.2) / 0.4;
        node.scale.setScalar(1.0 + flash * 0.4);
        lerpScratch.copy(surfaceCol).lerp(cyanCol, flash);
        mat.color.copy(lerpScratch);
      } else {
        node.scale.setScalar(1.0);
        mat.color.copy(surfaceCol);
      }
    });
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.0, 64]} />
        <meshBasicMaterial ref={ringMatRef} transparent />
      </mesh>
      {NODES.map((n, i) => (
        <Node
          key={n.id}
          pos={n.pos}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
        />
      ))}
    </>
  );
}

import { forwardRef } from "react";
import * as THREE from "three";
import { color } from "../../styles/tokens";

interface NodeProps {
  pos: readonly [number, number, number];
}

/**
 * Sonar runtime node — small filled circle in world space. Pulses (scale +
 * color flash) are driven externally by PingScene via the forwarded ref.
 */
export const Node = forwardRef<THREE.Mesh, NodeProps>(function Node(
  { pos },
  ref,
) {
  return (
    <mesh ref={ref} position={[pos[0], pos[1], pos[2]]}>
      <circleGeometry args={[0.18, 32]} />
      <meshBasicMaterial color={color.surface} />
    </mesh>
  );
});

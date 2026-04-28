/**
 * Locked sonar-node positions and ping-loop timing constants.
 *
 * Single source of truth for both the R3F PingScene (3D positions + hitAt
 * fractions) and the DOM-overlay NodeBadges (overlay 2D % positions).
 *
 * Values come verbatim from .planning/phases/01-public-landing/01-RESEARCH.md
 * §Pattern 3 — modifying any of these breaks the locked LAND-02 visual.
 */

export type NodeId = "ALICE" | "BOB" | "CHARLIE";

export interface SonarNode {
  id: NodeId;
  /** 3D world position consumed by R3F meshes. */
  pos: readonly [number, number, number];
  /**
   * Fraction of OUTGOING_END at which the expanding ring radius reaches
   * this node and triggers its pulse.
   */
  hitAt: number;
  /**
   * 2D projection of `pos` for DOM-overlay badge positioning, expressed
   * as % of the canvas slot (consumed by NodeBadge inline `style`).
   */
  overlay: { left: string; top: string };
}

export const NODES: readonly SonarNode[] = [
  { id: "ALICE",   pos: [-1.4, 0,  0.6], hitAt: 0.40, overlay: { left: "22%", top: "62%" } },
  { id: "BOB",     pos: [ 1.6, 0, -0.2], hitAt: 0.65, overlay: { left: "78%", top: "44%" } },
  { id: "CHARLIE", pos: [ 0.2, 0,  1.4], hitAt: 0.85, overlay: { left: "55%", top: "82%" } },
] as const;

/** Total loop duration in seconds (D-01: ~2-3s autonomous loop). */
export const LOOP_SECONDS = 2.4;
/** End of the cyan→blue outgoing-ring expansion phase. */
export const OUTGOING_END = 1.2;
/** End of the off-white echo-return phase (then settle until LOOP_SECONDS). */
export const ECHO_END = 2.2;

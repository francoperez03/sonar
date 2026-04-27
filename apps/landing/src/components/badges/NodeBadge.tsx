import type { CSSProperties } from "react";
import styles from "./NodeBadge.module.css";
import type { NodeId } from "../hero/nodes";

interface NodeBadgeProps {
  label: NodeId;
  /**
   * Positional CSS only (left/top as % strings). The rest of the visual
   * style comes from the module CSS — this prop is the documented
   * exception to D-13 for layout coordinates of overlay items.
   */
  style?: CSSProperties;
}

export function NodeBadge({ label, style }: NodeBadgeProps) {
  return (
    <span className={styles.badge} style={style}>
      {label}
    </span>
  );
}

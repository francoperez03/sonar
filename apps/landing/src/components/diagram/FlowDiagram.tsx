import { motion } from "framer-motion";
import styles from "./FlowDiagram.module.css";

const NODES = [
  "Prompt",
  "Agent",
  "Sonar MCP",
  "KeeperHub",
  "Sonar",
  "Runtime",
] as const;

// Horizontal layout — desktop. viewBox 1080 x 160. 6 nodes evenly spaced.
const H_NODE_W = 156;
const H_NODE_H = 56;
const H_GAP = 24;
const H_TOTAL = NODES.length * H_NODE_W + (NODES.length - 1) * H_GAP;
const H_START_X = (1080 - H_TOTAL) / 2;
const H_Y = 52;

// Vertical layout — mobile. viewBox 320 x 720. 6 stacked nodes.
const V_NODE_W = 240;
const V_NODE_H = 56;
const V_GAP = 56;
const V_X = (320 - V_NODE_W) / 2;
const V_START_Y = 24;

export function FlowDiagram() {
  return (
    <>
      {/* Desktop / horizontal */}
      <svg
        className={`${styles.flow} ${styles.horizontal}`}
        viewBox="0 0 1080 160"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Prompt to Agent to Sonar MCP to KeeperHub to Sonar to Runtime"
      >
        {/* connectors */}
        {NODES.slice(0, -1).map((_, i) => {
          const x1 = H_START_X + (i + 1) * H_NODE_W + i * H_GAP;
          const x2 = x1 + H_GAP;
          const y = H_Y + H_NODE_H / 2;
          return (
            <motion.path
              key={`hc-${i}`}
              className={styles.connector}
              d={`M ${x1} ${y} L ${x2} ${y}`}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.2, 0.8, 0.2, 1],
              }}
            />
          );
        })}
        {NODES.map((label, i) => {
          const x = H_START_X + i * (H_NODE_W + H_GAP);
          return (
            <g key={`hn-${label}`}>
              <rect
                className={styles.node}
                x={x}
                y={H_Y}
                width={H_NODE_W}
                height={H_NODE_H}
                rx={8}
                ry={8}
              />
              <text
                className={styles.label}
                x={x + H_NODE_W / 2}
                y={H_Y + H_NODE_H / 2 + 4}
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Mobile / vertical */}
      <svg
        className={`${styles.flow} ${styles.vertical}`}
        viewBox="0 0 320 720"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-hidden="true"
      >
        {NODES.slice(0, -1).map((_, i) => {
          const y1 = V_START_Y + (i + 1) * V_NODE_H + i * V_GAP;
          const y2 = y1 + V_GAP;
          const x = V_X + V_NODE_W / 2;
          return (
            <motion.path
              key={`vc-${i}`}
              className={styles.connector}
              d={`M ${x} ${y1} L ${x} ${y2}`}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.2, 0.8, 0.2, 1],
              }}
            />
          );
        })}
        {NODES.map((label, i) => {
          const y = V_START_Y + i * (V_NODE_H + V_GAP);
          return (
            <g key={`vn-${label}`}>
              <rect
                className={styles.node}
                x={V_X}
                y={y}
                width={V_NODE_W}
                height={V_NODE_H}
                rx={8}
                ry={8}
              />
              <text
                className={styles.label}
                x={V_X + V_NODE_W / 2}
                y={y + V_NODE_H / 2 + 4}
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

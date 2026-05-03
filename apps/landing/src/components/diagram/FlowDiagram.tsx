import { motion } from "framer-motion";
import styles from "./FlowDiagram.module.css";

const WORKFLOW_STEPS = ["generate", "fund", "distribute", "deprecate"] as const;
const REAL_RUNTIMES = ["alpha", "beta", "gamma"] as const;

interface FlowNodeProps {
  title: string;
  detail: string;
  x: number;
  y: number;
  width: number;
  tone?: "default" | "primary" | "chain";
  delay?: number;
}

function FlowNode({
  title,
  detail,
  x,
  y,
  width,
  tone = "default",
  delay = 0,
}: FlowNodeProps) {
  return (
    <motion.g
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.35, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <rect
        className={`${styles.node} ${tone === "primary" ? styles.nodePrimary : ""} ${
          tone === "chain" ? styles.nodeChain : ""
        }`}
        x={x}
        y={y}
        width={width}
        height="72"
        rx="8"
        ry="8"
      />
      <text className={styles.label} x={x + 18} y={y + 29}>
        {title}
      </text>
      <text className={styles.subLabel} x={x + 18} y={y + 52}>
        {detail}
      </text>
    </motion.g>
  );
}

function StepChip({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <g>
      <rect className={styles.chip} x={x} y={y} width="106" height="30" rx="4" ry="4" />
      <text className={styles.chipText} x={x + 53} y={y + 20} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function RuntimeNode({
  label,
  x,
  y,
  width = 156,
  height = 76,
  clone = false,
}: {
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  clone?: boolean;
}) {
  const cx = x + width / 2;
  const cy = y + height / 2;

  return (
    <g>
      {!clone && <circle className={styles.echoHalo} cx={cx} cy={cy} r={Math.min(width, height) / 2} />}
      <rect
        className={`${styles.runtimeNode} ${clone ? styles.runtimeClone : styles.runtimeReal}`}
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        ry="8"
      />
      <text className={styles.runtimeTitle} x={cx} y={y + 32} textAnchor="middle">
        {label}
      </text>
      <text className={styles.runtimeDetail} x={cx} y={y + 55} textAnchor="middle">
        {clone ? "signature rejected" : "signed echo"}
      </text>
      {clone && (
        <>
          <rect
            className={styles.rejectedBadge}
            x={cx - 43}
            y={y + height - 24}
            width="86"
            height="18"
            rx="4"
            ry="4"
          />
          <text className={styles.rejectedBadgeText} x={cx} y={y + height - 11} textAnchor="middle">
            rejected
          </text>
        </>
      )}
    </g>
  );
}

export function FlowDiagram() {
  return (
    <>
      <svg
        className={`${styles.flow} ${styles.horizontal}`}
        viewBox="0 0 1180 500"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Prompt to Agent to Sonar MCP to KeeperHub workflow to Sonar Runtime fleet and Base Sepolia"
      >
        <defs>
          <marker
            id="flow-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path className={styles.arrowHead} d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
          <marker
            id="reject-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path className={styles.rejectArrowHead} d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
        </defs>

        <rect className={styles.lane} x="28" y="28" width="270" height="300" rx="14" />
        <rect className={styles.lane} x="338" y="28" width="318" height="300" rx="14" />
        <rect className={styles.lane} x="696" y="28" width="456" height="396" rx="14" />
        <text className={styles.laneLabel} x="50" y="62">
          orchestration
        </text>
        <text className={styles.laneLabel} x="360" y="62">
          workflow
        </text>
        <text className={styles.laneLabel} x="718" y="62">
          verification + fleet
        </text>

        <path className={styles.edge} d="M 158 160 L 158 184" />
        <path className={styles.edge} d="M 258 220 C 298 220 306 124 346 124" />
        <path className={styles.edge} d="M 464 160 L 464 184" />
        <path className={styles.edge} d="M 606 220 C 660 220 674 124 716 124" />
        <path className={styles.edge} d="M 834 160 L 834 284" />
        <path className={styles.edge} d="M 834 284 C 806 300 786 306 774 318" />
        <path className={styles.edge} d="M 834 284 C 852 300 872 306 886 318" />
        <path className={styles.edge} d="M 834 284 C 920 300 980 306 998 318" />
        <path className={styles.edgeReject} d="M 1076 224 C 1028 180 938 160 832 160" />
        <text className={styles.rejectLabel} x="1054" y="214" textAnchor="middle">
          invalid signature
        </text>
        <FlowNode title="Prompt" detail="rotate alpha beta gamma" x={58} y={88} width={200} />
        <FlowNode title="Agent" detail="plans the tool call" x={58} y={184} width={200} delay={0.05} />
        <FlowNode title="Sonar MCP" detail="run_rotation" x={346} y={88} width={236} tone="primary" delay={0.1} />
        <FlowNode title="KeeperHub" detail="workflow run" x={370} y={184} width={236} tone="primary" delay={0.15} />

        {WORKFLOW_STEPS.map((step, i) => (
          <StepChip
            key={step}
            label={step}
            x={370 + (i % 2) * 122}
            y={276 + Math.floor(i / 2) * 42}
          />
        ))}

        <FlowNode title="Operator" detail="Sonar signature gate" x={716} y={88} width={236} tone="primary" delay={0.2} />
        <rect className={styles.callout} x="714" y="186" width="228" height="38" rx="6" />
        <text className={styles.calloutText} x="736" y="210">
          Valid signature required
        </text>

        {REAL_RUNTIMES.map((runtime, i) => (
          <RuntimeNode key={runtime} label={runtime} x={724 + i * 112} y={318} width={100} />
        ))}
        <RuntimeNode label="gamma-clone" x={994} y={222} width={134} clone />

        <text className={styles.fleetLabel} x="720" y="306">
          Real runtimes
        </text>
        <FlowNode title="Base Sepolia" detail="on-chain deprecate" x={744} y={426} width={236} tone="chain" delay={0.3} />
        <path className={styles.edgeChain} d="M 774 394 C 774 410 792 418 824 426" />
        <path className={styles.edgeChain} d="M 886 394 L 886 426" />
        <path className={styles.edgeChain} d="M 998 394 C 998 410 962 418 930 426" />
        <text className={styles.edgeLabel} x="930" y="412" textAnchor="middle">
          deprecate tx
        </text>
      </svg>

      <svg
        className={`${styles.flow} ${styles.vertical}`}
        viewBox="0 0 360 1108"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Prompt to Agent to Sonar MCP to KeeperHub workflow to Sonar Runtime fleet and Base Sepolia"
      >
        <defs>
          <marker
            id="flow-arrow-mobile"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path className={styles.arrowHead} d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
          <marker
            id="reject-arrow-mobile"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path className={styles.rejectArrowHead} d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
        </defs>

        <text className={styles.laneLabel} x="28" y="34">
          orchestration
        </text>
        <FlowNode title="Prompt" detail="rotate alpha beta gamma" x={28} y={54} width={304} />
        <path className={styles.mobileEdge} d="M 180 126 L 180 154" />
        <FlowNode title="Agent" detail="plans the tool call" x={28} y={154} width={304} delay={0.05} />
        <path className={styles.mobileEdge} d="M 180 226 L 180 254" />
        <FlowNode title="Sonar MCP" detail="run_rotation" x={28} y={254} width={304} tone="primary" delay={0.1} />

        <text className={styles.laneLabel} x="28" y="370">
          workflow
        </text>
        <path className={styles.mobileEdge} d="M 180 326 L 180 384" />
        <FlowNode title="KeeperHub" detail="workflow run" x={28} y={392} width={304} tone="primary" delay={0.15} />
        {WORKFLOW_STEPS.map((step, i) => (
          <StepChip key={`mobile-${step}`} label={step} x={36 + (i % 2) * 144} y={482 + Math.floor(i / 2) * 42} />
        ))}

        <text className={styles.laneLabel} x="28" y="604">
          verification + fleet
        </text>
        <path className={styles.mobileEdge} d="M 180 548 L 180 618" />
        <FlowNode title="Operator" detail="Sonar signature gate" x={28} y={626} width={304} tone="primary" delay={0.2} />
        <rect className={styles.callout} x="82" y="712" width="196" height="38" rx="6" />
        <text className={styles.calloutText} x="180" y="736" textAnchor="middle">
          Valid signature required
        </text>
        <path className={styles.mobileEdge} d="M 180 698 L 180 772" />
        <path className={styles.mobileRejectEdge} d="M 180 820 C 250 778 248 724 210 698" />
        <text className={styles.rejectLabel} x="254" y="790" textAnchor="middle">
          invalid signature
        </text>

        <text className={styles.fleetLabel} x="28" y="776">
          Real runtimes
        </text>
        <RuntimeNode label="gamma-clone" x={92} y={820} width={176} clone />
        <RuntimeNode label="alpha" x={20} y={922} width={98} />
        <RuntimeNode label="beta" x={131} y={922} width={98} />
        <RuntimeNode label="gamma" x={242} y={922} width={98} />

        <FlowNode title="Base Sepolia" detail="on-chain deprecate" x={28} y={1012} width={304} tone="chain" delay={0.3} />
        <path className={styles.mobileChainEdge} d="M 69 998 C 88 1008 102 1012 118 1012" />
        <path className={styles.mobileChainEdge} d="M 180 998 L 180 1012" />
        <path className={styles.mobileChainEdge} d="M 291 998 C 272 1008 258 1012 242 1012" />
      </svg>
    </>
  );
}

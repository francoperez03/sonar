import { Section } from "../components/primitives/Section";
import { FlowDiagram } from "../components/diagram/FlowDiagram";
import styles from "./sections.module.css";

export function ApproachSection() {
  return (
    <Section id="approach" eyebrow="02 / APPROACH">
      <h2 className={styles.heading}>
        Ping the fleet. Only the real one echoes back.
      </h2>
      <p className={styles.body}>
        Sonar drives a KeeperHub workflow: generate wallets, fund them,
        distribute, deprecate. At distribute, each runtime signs an Ed25519
        challenge before the encrypted key is shipped. The LLM coordinates —
        never custodies.
      </p>
      <div className={styles.diagramSlot}>
        <span className={styles.diagramEyebrow}>02 / FLOW</span>
        <FlowDiagram />
      </div>
    </Section>
  );
}

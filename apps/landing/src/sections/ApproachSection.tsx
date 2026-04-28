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
        When Sonar rotates credentials, every runtime gets pinged with an
        Ed25519 challenge. Only the runtime holding the matching identity can
        sign the echo and decrypt the new key. The LLM orchestrates the
        rotation but never holds a credential — clones and impostors get
        nothing back.
      </p>
      <div className={styles.diagramSlot}>
        <span className={styles.diagramEyebrow}>02 / FLOW</span>
        <FlowDiagram />
      </div>
    </Section>
  );
}

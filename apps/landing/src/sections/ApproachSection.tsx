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
        The LLM orchestrates the full rotation, generate, fund, distribute and
        deprecate on-chain without touching a single key. Each runtime signs
        a challenge before anything is delivered. No valid signature, no key.
        Clones don't pass.
      </p>
      <div className={styles.diagramSlot}>
        <FlowDiagram />
      </div>
    </Section>
  );
}

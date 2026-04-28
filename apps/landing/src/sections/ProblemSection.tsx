import { ProblemDiagram } from "../components/diagram/ProblemDiagram";
import { Section } from "../components/primitives/Section";
import styles from "./sections.module.css";

export function ProblemSection() {
  return (
    <Section id="problem" eyebrow="01 / PROBLEM">
      <h2 className={styles.heading}>
        Your agent is a liability with the keys.
      </h2>
      <p className={styles.body}>
        Today&apos;s agents hold long-lived secrets in plaintext context. One
        prompt-injection or one log leak and the keys walk. OWASP LLM06 names
        it; production deployments still ship it. Sonar removes the LLM from
        custody by construction.
      </p>
      <ProblemDiagram />
    </Section>
  );
}

import { Section } from "../components/primitives/Section";
import styles from "./sections.module.css";

export function ProblemSection() {
  return (
    <Section id="problem" eyebrow="01 / PROBLEM" narrow>
      <h2 className={styles.heading}>
        Your agent is a liability with the keys.
      </h2>
      <p className={styles.body}>
        Today&apos;s agents hold secrets in plaintext context. The LLM cannot
        tell which lines are trusted and which were injected by an attacker.
        One log entry and the key walks. OWASP LLM06 names it; production
        deployments still ship it. Sonar never shows the LLM a key.
      </p>
    </Section>
  );
}

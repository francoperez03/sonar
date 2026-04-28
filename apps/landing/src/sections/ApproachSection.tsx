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
        The LLM runs the whole flow through KeeperHub — generate wallets, fund
        them on Base Sepolia, distribute, deprecate the old ones on-chain.
        Before any key is delivered, each runtime signs an Ed25519 challenge.
        The private key never leaves memory, so a clone can't sign. It just
        gets blocked.
      </p>
      <div className={styles.diagramSlot}>
        <span className={styles.diagramEyebrow}>02 / FLOW</span>
        <FlowDiagram />
      </div>
    </Section>
  );
}

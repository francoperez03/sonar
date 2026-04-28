import { Section } from "../components/primitives/Section";
import { Button } from "../components/primitives/Button";
import styles from "./sections.module.css";

export function DemoCtaSection() {
  const videoHref = import.meta.env.VITE_DEMO_VIDEO_URL ?? "#demo";
  return (
    <Section id="demo" eyebrow="03 / SEE IT RUN">
      <div className={styles.card}>
        <h2 className={styles.heading}>
          Watch a key rotate end-to-end in 90 seconds.
        </h2>
        <p className={styles.body}>
          A live run from an agent prompt, four KeeperHub nodes on Base
          Sepolia, three runtimes in the fleet, one clone rejected at the door.
          Source on GitHub if you want to read the wire.
        </p>
        <div className={styles.ctaRow}>
          <Button variant="primary" disabled badge="Soon">
            Watch the 90s demo
          </Button>
          <Button variant="secondary" disabled badge="Soon">
            Read the source
          </Button>
        </div>
      </div>
    </Section>
  );
}

import { Container } from "../primitives/Container";
import styles from "./Footer.module.css";

const REPO_HREF = "https://github.com/francoperez03/sonar";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container variant="wide">
        <p className={styles.meta}>
          Sonar — built for ETHGlobal OpenAgents 2026 · Track: Best Use of
          KeeperHub · Non-custodial by construction
        </p>
        <div className={styles.row}>
          <a
            className={styles.repo}
            href={REPO_HREF}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <span className={styles.testnetNote}>Base Sepolia testnet only</span>
        </div>
      </Container>
    </footer>
  );
}

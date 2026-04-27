import { Container } from "../primitives/Container";
import styles from "./Nav.module.css";

const REPO_HREF = "https://github.com/francoperez03/sonar";

export function Nav() {
  return (
    <nav className={styles.nav} aria-label="Primary">
      <Container variant="wide" className={styles.row}>
        <a className={styles.wordmark} href="/">
          SONAR
        </a>
        <a
          className={styles.github}
          href={REPO_HREF}
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub
        </a>
      </Container>
    </nav>
  );
}

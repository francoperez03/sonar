import { Container } from "../primitives/Container";
import styles from "./Footer.module.css";

const REPO_HREF = "https://github.com/francoperez03/sonar";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container variant="wide">
        <div className={styles.row}>
          <p className={styles.meta}>
            Built with ❤️ for ETHGlobal OpenAgents
          </p>
          <a
            className={styles.repo}
            href={REPO_HREF}
            rel="noopener noreferrer"
            target="_blank"
            aria-label="GitHub repository"
          >
            <svg
              className={styles.repoIcon}
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54 0-.27-.01-1.16-.02-2.1-3.13.68-3.79-1.34-3.79-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.16.9-.25 1.86-.37 2.82-.38.96.01 1.92.13 2.82.38 2.14-1.46 3.08-1.16 3.08-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.29-5.15 5.56.4.35.76 1.04.76 2.1 0 1.51-.01 2.73-.01 3.1 0 .3.2.65.78.54 4.46-1.49 7.68-5.7 7.68-10.67C23.25 5.48 18.27.5 12 .5z" />
            </svg>
          </a>
        </div>
      </Container>
    </footer>
  );
}

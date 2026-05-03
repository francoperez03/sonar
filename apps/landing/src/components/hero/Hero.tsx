import { Suspense, lazy } from 'react';
import { HeroFallback } from './HeroFallback';
import styles from './Hero.module.css';

const HeroCanvas = lazy(() => import('./HeroCanvas'));

export function Hero() {
  const demoHref = import.meta.env.VITE_DEMO_APP_URL ?? 'https://sonar-demo-ui.vercel.app/';

  return (
    <div className={styles.heroOuter}>
      <section className={styles.hero} aria-label="Sonar hero" data-testid="hero">
        <div className={styles.content}>
          <span className={styles.eyebrow}>SONAR / v0.1</span>
          <h1 className={styles.display}>Rotate keys without trusting the agent.</h1>
          <p className={styles.body}>
            Open the live cockpit: three agent runtimes are already running with Base Sepolia
            balances. Ask Sonar to inspect them, rotate their keys, and watch the old wallets get
            deprecated on-chain while the private keys stay out of the model.
          </p>
          <div className={styles.ctaRow}>
            <a className={`${styles.btn} ${styles.btnPrimary}`} href={demoHref}>
              Go to app
            </a>
            <a
              className={`${styles.btn} ${styles.btnSecondary}`}
              href="https://github.com/francoperez03/sonar"
            >
              Go to GitHub
            </a>
          </div>
        </div>
        <div className={styles.canvasSlot} data-testid="hero-canvas-slot">
          <Suspense fallback={<HeroFallback />}>
            <HeroCanvas />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

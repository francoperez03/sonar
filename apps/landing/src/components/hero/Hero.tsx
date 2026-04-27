import { Suspense, lazy } from "react";
import { HeroFallback } from "./HeroFallback";
import styles from "./Hero.module.css";

const HeroCanvas = lazy(() => import("./HeroCanvas"));

export function Hero() {
  const demoHref = import.meta.env.VITE_DEMO_VIDEO_URL ?? "#demo";

  return (
    <section
      className={styles.hero}
      aria-label="Sonar hero"
      data-testid="hero"
    >
      <div className={styles.content}>
        <span className={styles.eyebrow}>SONAR / v0.1</span>
        <h1 className={styles.display}>
          Rotate keys without trusting the agent.
        </h1>
        <p className={styles.body}>
          An LLM orchestrates credential rotation across your runtime fleet —
          and never sees a private key. Each runtime proves identity with
          Ed25519 before delivery. A cloned binary can't catch the echo.
        </p>
        <div className={styles.ctaRow}>
          <a
            className={`${styles.btn} ${styles.btnPrimary}`}
            href={demoHref}
          >
            Watch the 90s demo
          </a>
          <a
            className={`${styles.btn} ${styles.btnSecondary}`}
            href="https://github.com/francoperez03/sonar"
          >
            Read the source
          </a>
        </div>
      </div>
      <div
        className={styles.canvasSlot}
        data-testid="hero-canvas-slot"
      >
        <Suspense fallback={<HeroFallback />}>
          <HeroCanvas />
        </Suspense>
      </div>
    </section>
  );
}

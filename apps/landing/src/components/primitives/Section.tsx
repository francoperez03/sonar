import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Container } from "./Container";
import { Eyebrow } from "./Eyebrow";
import styles from "./Section.module.css";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  children: ReactNode;
  narrow?: boolean;
};

export function Section({ id, eyebrow, children, narrow }: SectionProps) {
  return (
    <motion.section
      id={id}
      className={styles.section}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Container variant={narrow ? "narrow" : "wide"}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {children}
      </Container>
    </motion.section>
  );
}

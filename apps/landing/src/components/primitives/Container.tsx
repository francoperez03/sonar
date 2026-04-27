import type { ReactNode } from "react";
import styles from "./Container.module.css";

type ContainerProps = {
  variant?: "wide" | "narrow";
  children: ReactNode;
  className?: string;
};

export function Container({
  variant = "wide",
  children,
  className,
}: ContainerProps) {
  const cn = [styles.container, styles[variant], className]
    .filter(Boolean)
    .join(" ");
  return <div className={cn}>{children}</div>;
}

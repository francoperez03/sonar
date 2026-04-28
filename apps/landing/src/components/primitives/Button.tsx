import type { ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonProps = {
  variant: "primary" | "secondary";
  href?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function Button({ variant, href, children, onClick, disabled, badge }: ButtonProps) {
  const cn = `${styles.btn} ${styles[variant]}${disabled ? ` ${styles.disabled}` : ""}`;
  const content = (
    <>
      {children}
      {badge && <span className={styles.badge}>{badge}</span>}
    </>
  );
  if (href && !disabled) {
    const external = isExternal(href);
    return (
      <a
        className={cn}
        href={href}
        {...(external
          ? { rel: "noopener noreferrer", target: "_blank" }
          : {})}
      >
        {content}
      </a>
    );
  }
  return (
    <button className={cn} type="button" onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

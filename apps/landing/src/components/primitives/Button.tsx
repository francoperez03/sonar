import type { ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonProps = {
  variant: "primary" | "secondary";
  href?: string;
  children: ReactNode;
  onClick?: () => void;
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function Button({ variant, href, children, onClick }: ButtonProps) {
  const cn = `${styles.btn} ${styles[variant]}`;
  if (href) {
    const external = isExternal(href);
    return (
      <a
        className={cn}
        href={href}
        {...(external
          ? { rel: "noopener noreferrer", target: "_blank" }
          : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button className={cn} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

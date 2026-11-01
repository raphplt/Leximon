import type { ComponentProps, ReactNode } from "react";
import styles from "./ui.module.css";

/** A block of a screen; `framed` gives it the printed frame, for what stands out on its page. */
export function Panel({
  framed = false,
  className,
  children,
  ...section
}: {
  readonly framed?: boolean;
  readonly children: ReactNode;
} & ComponentProps<"section">) {
  return (
    <section
      className={`${styles.panel} ${framed ? styles.framed : ""} ${className ?? ""}`}
      {...section}
    >
      {children}
    </section>
  );
}

import type { ReactNode } from "react";
import styles from "./ui.module.css";

/** Rows set apart by a fine rule, as in a dictionary. */
export function RuledList({ children }: { readonly children: ReactNode }) {
  return <ul className={styles.ruled}>{children}</ul>;
}

export function RuledRow({ children }: { readonly children: ReactNode }) {
  return <li className={styles.ruledRow}>{children}</li>;
}

/** A label and its value, joined by a line of dots, as in a table of contents. */
export function Leader({
  label,
  children,
}: {
  readonly label: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.leader}>
      <dt className={styles.leaderLabel}>{label}</dt>
      <span className={styles.leaderDots} aria-hidden="true" />
      <dd className={styles.leaderValue}>{children}</dd>
    </div>
  );
}

export function Leaders({ children }: { readonly children: ReactNode }) {
  return <dl className={styles.leaders}>{children}</dl>;
}

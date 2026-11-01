import type { ReactNode } from "react";
import { Plate } from "./ornament";
import styles from "./ui.module.css";

/** A list with nothing in it yet: a sentence that says so, and what to do next if anything. */
export function EmptyState({
  children,
  action,
}: {
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyMark}>
        <Plate name="f06" width={132} />
      </span>
      <p className={styles.emptyText}>{children}</p>
      {action}
    </div>
  );
}

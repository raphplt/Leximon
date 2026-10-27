import type { CSSProperties } from "react";
import styles from "./ui.module.css";

/** The thick XP bar of the level. `ratio` between 0 and 1. */
export function XpBar({
  ratio,
  thin,
  className,
}: {
  readonly ratio: number;
  readonly thin?: boolean;
  readonly className?: string | undefined;
}) {
  return (
    <span className={`${styles.bar} ${thin ? styles.barThin : ""} ${className ?? ""}`}>
      <span
        className={styles.barFill}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` }}
      />
    </span>
  );
}

/** The red level medal, the one look of the level everywhere. */
export function LevelMedal({
  level,
  size,
  small = false,
}: {
  readonly level: number;
  readonly size: number;
  /** Lighter relief, for the bars. */
  readonly small?: boolean;
}) {
  return (
    <span
      className={small ? `${styles.medal} ${styles.medalSmall}` : styles.medal}
      style={{ width: size, height: size } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.display} style={{ fontSize: Math.round(size * 0.44) }}>
        {level}
      </span>
    </span>
  );
}

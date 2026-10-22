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

/** The red level medal. */
export function LevelMedal({ level, size }: { readonly level: number; readonly size: number }) {
  return (
    <span
      className={styles.medal}
      style={{ width: size, height: size } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.display} style={{ fontSize: Math.round(size * 0.44) }}>
        {level}
      </span>
    </span>
  );
}

/** Ring around the level or the avatar: the share of the level already earned, in gold. */
export function ringStyle(ratio: number): CSSProperties {
  const degrees = Math.round(Math.min(1, Math.max(0, ratio)) * 360);
  return {
    background: `conic-gradient(var(--lx-color-accent) ${degrees}deg, var(--lx-color-track) 0)`,
  };
}

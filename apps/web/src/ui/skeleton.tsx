import type { CSSProperties, ReactNode } from "react";
import styles from "./skeleton.module.css";

/**
 * A shape standing in for content on its way, at that content's size: nothing moves when it
 * lands. It shows only if the wait lasts, so a quick answer never flashes it.
 */
export function Bone({
  className,
  style,
}: {
  readonly className?: string | undefined;
  readonly style?: CSSProperties;
}) {
  return (
    <span
      className={className === undefined ? styles.bone : `${styles.bone} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * A screen waiting for its data: the shapes tell the eye, a sentence tells screen readers.
 * Without shapes when the screen to come is not known yet: an empty frame, rather than a guess.
 */
export function WaitingScreen({
  className,
  children,
}: {
  readonly className: string | undefined;
  readonly children?: ReactNode;
}) {
  return (
    <main className={className} aria-busy="true">
      <span className={styles.spoken}>Un instant…</span>
      {children}
    </main>
  );
}

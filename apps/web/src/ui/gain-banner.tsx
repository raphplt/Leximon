import type { ToyIconName } from "@leximon/tokens";
import type { CSSProperties } from "react";
import styles from "./gain-banner.module.css";
import { ToyIcon } from "./toy";

/**
 * What the player just won, on red leather in an old-gold frame: the reward drawn in its
 * medallion, the gain lettered beside it, where it went underneath.
 */
export function GainBanner({
  icon,
  title,
  note,
  className,
  style,
}: {
  readonly icon: ToyIconName;
  /** « 1 sachet bonus » */
  readonly title: string;
  /** « Dans ta réserve » */
  readonly note?: string | null | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}) {
  return (
    <div className={[styles.banner, className].filter(Boolean).join(" ")} style={style}>
      <span className={styles.medallion} aria-hidden="true">
        <ToyIcon name={icon} size={34} />
      </span>
      <span className={styles.words}>
        <strong className={styles.title}>{title}</strong>
        {note != null && <span className={styles.note}>{note}</span>}
      </span>
    </div>
  );
}

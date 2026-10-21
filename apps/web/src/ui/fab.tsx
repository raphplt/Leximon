import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import styles from "./ui.module.css";

/**
 * A floating button of the Jouer screen (J-04): a round icon and its label, with the red count
 * of what waits, or the level that opens it.
 */
export function Fab({
  icon,
  label,
  badge = 0,
  lock = null,
  glow = false,
  onClick,
  ring,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly badge?: number;
  readonly lock?: string | null;
  readonly glow?: boolean;
  readonly onClick: () => void;
  /** Drawn behind the circle, e.g. the ring of the daily challenge. */
  readonly ring?: ReactNode;
}) {
  const circle = [
    styles.fabCircle,
    glow ? `${styles.fabGold} ${styles.glow}` : "",
    lock !== null ? styles.fabLocked : "",
  ].join(" ");
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      aria-label={
        lock !== null
          ? `${label}, ${lock.replace("Niv.", "niveau")}`
          : badge > 0
            ? `${label}, ${badge}`
            : label
      }
    >
      <span className={circle}>
        {ring}
        <Icon name={icon} size={25} />
        {badge > 0 && lock === null && <span className={styles.badge}>{badge}</span>}
        {lock !== null && <span className={styles.lockBadge}>{lock}</span>}
      </span>
      <span className={styles.fabLabel}>{label}</span>
    </button>
  );
}

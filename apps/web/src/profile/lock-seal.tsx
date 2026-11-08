import { Icon } from "@/ui/icon";
import styles from "./profile.module.css";

/** On a piece not yet the player's: a lock over its faded drawing. */
export function LockSeal() {
  return (
    <span className={styles.lockSeal} aria-hidden="true">
      <Icon name="lock" size={18} />
    </span>
  );
}

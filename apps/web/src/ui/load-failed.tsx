import { Button } from "./button";
import styles from "./load-failed.module.css";

/**
 * What a screen shows when the data it waits for could not be read: what happened, and the way
 * to try again, instead of a wait that never ends.
 */
export function LoadFailed({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <div className={styles.failed} role="alert">
      <p className={styles.text}>Le serveur ne répond pas.</p>
      <Button variant="secondary" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

import { STORE_BADGES, STORE_LINKS, STORES, type Store } from "@leximon/view-model";
import styles from "./store-badges.module.css";

/** Google Play's mark, in its four colours. */
function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="#2196f3"
        d="M3.6 1.8 13.4 12l-9.8 10.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Z"
      />
      <path fill="#34a853" d="m3.6 1.8 13 7L13.4 12Z" />
      <path fill="#ea4335" d="m3.6 22.2 9.8-10.2 3.2 3.2Z" />
      <path fill="#fbbc04" d="m16.6 8.8 3.8 2.1c.8.5.8 1.7 0 2.2l-3.8 2.1-3.2-3.2Z" />
    </svg>
  );
}

/** Apple's mark, in one colour as Apple asks. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

const MARKS: Readonly<Record<Store, () => React.JSX.Element>> = {
  android: PlayMark,
  ios: AppleMark,
};

/**
 * The app on both stores, as the stores' own black badges. `place` tells the visit counter which
 * badge brought the player.
 */
export function StoreBadges({
  place,
  small = false,
  className,
}: {
  readonly place: string;
  readonly small?: boolean;
  readonly className?: string | undefined;
}) {
  return (
    // Plain links, not a list: the pages that hold them style their own lists.
    <div className={`${styles.badges} ${className ?? ""}`} data-small={small || undefined}>
      {STORES.map((store) => {
        const Mark = MARKS[store];
        const badge = STORE_BADGES[store];
        return (
          <a
            key={store}
            href={STORE_LINKS[store]}
            className={styles.badge}
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="store"
            data-umami-event-store={store}
            data-umami-event-place={place}
          >
            <Mark />
            <span className={styles.text}>
              <span className={styles.over}>{badge.over}</span>
              <span className={styles.name}>{badge.name}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

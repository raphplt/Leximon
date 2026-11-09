import styles from "./illuminated-border.module.css";

const CORNERS = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;

/** One arm of a fleuron: a gilt stem along the rule, a red leaf, a curl and a bezant at its end. */
function FleuronArm({ transform }: { readonly transform?: string }) {
  const stem = "M16 8 H33 C43 8 50 10 50 17 C50 22 44 24 41 20 C39 17 42 14 45 16";
  return (
    <g transform={transform}>
      <path className={styles.stemInk} d={stem} />
      <path className={styles.stemGold} d={stem} />
      <path
        className={styles.leafRed}
        d="M22 9 C25 16 32 20 39 18 C36 12 30 9 22 9 Z M24 10 L36 17"
      />
      <circle className={styles.bezant} cx="57" cy="8" r="2.4" />
    </g>
  );
}

/**
 * A fleuron in the corner of the rule: a lozenge on the corner, an arm along each side, a blue leaf
 * on the diagonal.
 */
function Fleuron() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <FleuronArm />
      <FleuronArm transform="matrix(0 1 1 0 0 0)" />
      <path
        className={styles.leafBlue}
        d="M15 15 C24 15 31 22 31 31 C22 31 15 24 15 15 Z M17 17 L28 28"
      />
      <path className={styles.bezant} d="M8 0 L16 8 L8 16 L0 8 Z" />
      <circle className={styles.dotRed} cx="8" cy="8" r="2.6" />
    </svg>
  );
}

/**
 * The illuminated frame of a card: a gilt double rule inside the leaf, a fleuron in each corner.
 * Decorative, laid over the leaf whatever its height; the leaf needs `position: relative` and
 * room enough in its padding.
 */
export function IlluminatedBorder() {
  return (
    <span className={styles.frame} aria-hidden="true">
      {CORNERS.map((corner) => (
        <span key={corner} className={`${styles.corner} ${styles[corner]}`}>
          <Fleuron />
        </span>
      ))}
    </span>
  );
}

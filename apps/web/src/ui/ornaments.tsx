import {
  bindingRule,
  fleuron,
  giltCorner,
  hedera,
  type Ornament,
  type OrnamentPaint,
  tailpiece,
  titleRule,
} from "@leximon/tokens";
import styles from "./ornaments.module.css";

/**
 * The ornaments of the paper. They are decorative, laid over the leaf whatever its size: the leaf
 * that holds a frame needs `position: relative` and room enough in its padding.
 */

const CORNERS = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;
const RUNS = ["top", "right", "bottom", "left"] as const;

const PAINTS: Readonly<Record<Exclude<OrnamentPaint, "stem">, string | undefined>> = {
  leafRed: styles.leafRed,
  leafBlue: styles.leafBlue,
  bezant: styles.bezant,
  dotRed: styles.dotRed,
  taper: styles.taper,
  rule: styles.rule,
  ruleThin: styles.ruleThin,
  gilt: styles.gilt,
  giltThick: styles.giltThick,
  giltThin: styles.giltThin,
};

function Drawing({
  ornament,
  className,
}: {
  readonly ornament: Ornament;
  readonly className?: string | undefined;
}) {
  return (
    <svg
      className={[styles.drawing, className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${ornament.width} ${ornament.height}`}
      aria-hidden="true"
    >
      {ornament.parts.map((part, index) =>
        part.paint === "stem" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
          <g key={index} transform={part.transform}>
            <path className={styles.stemInk} d={part.d} />
            <path className={styles.stemGold} d={part.d} />
          </g>
        ) : (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
            key={index}
            className={PAINTS[part.paint]}
            d={part.d}
            transform={part.transform}
          />
        ),
      )}
    </svg>
  );
}

/** The illuminated frame: a gilt rule, a red hairline inside it, a fleuron in each corner. */
export function Fleurons() {
  return (
    <span className={styles.fleuronFrame} aria-hidden="true">
      {CORNERS.map((corner) => (
        <span key={corner} className={`${styles.fleuron} ${styles[corner]}`}>
          <Drawing ornament={fleuron} />
        </span>
      ))}
    </span>
  );
}

/** The bookbinder's rule: a thick and a thin gilt line, turned inward at each corner. */
export function BindingRule() {
  return (
    <span className={styles.binding} aria-hidden="true">
      {RUNS.map((run) => (
        <span key={run} className={`${styles.run} ${styles[run]}`} />
      ))}
      {CORNERS.map((corner) => (
        <span key={corner} className={`${styles.bindingCorner} ${styles[corner]}`}>
          <Drawing ornament={bindingRule.corner} />
        </span>
      ))}
    </span>
  );
}

/** A single fine gilt fillet pressed into the leather, a little in from its edge. */
export function Tooling() {
  return <span className={styles.tooling} aria-hidden="true" />;
}

/** A gilt square in each corner of a small tile, without a rule between them. */
export function GiltCorners() {
  return (
    <span className={styles.overlay} aria-hidden="true">
      {CORNERS.map((corner) => (
        <span key={corner} className={`${styles.giltCorner} ${styles[corner]}`}>
          <Drawing ornament={giltCorner} />
        </span>
      ))}
    </span>
  );
}

/** A gilt rule under a section title. */
export function TitleRule({ className }: { readonly className?: string | undefined }) {
  return <Drawing ornament={titleRule} className={[styles.titleRule, className].join(" ")} />;
}

/** A tailpiece, to close a section or to part two. */
export function Tailpiece({ className }: { readonly className?: string | undefined }) {
  return <Drawing ornament={tailpiece} className={[styles.tailpiece, className].join(" ")} />;
}

/** An ivy leaf, set before a title. */
export function Hedera({ flip = false }: { readonly flip?: boolean }) {
  return <Drawing ornament={hedera} className={flip ? styles.hederaFlip : styles.hedera} />;
}

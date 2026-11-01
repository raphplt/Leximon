import { levelBadge, levelBadgeBox, levelBadgeLip, levelBadgeText } from "@leximon/tokens";
import { levelLabel } from "@leximon/view-model";
import { useId } from "react";
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

/**
 * The level badge, the one look of a level everywhere: a player's or a clan's. Decorative unless
 * `labelled`, for the lists where the number stands alone.
 */
export function LevelMedal({
  level,
  size,
  labelled = false,
}: {
  readonly level: number;
  readonly size: number;
  readonly labelled?: boolean;
}) {
  // The gradients are referenced by id: React's own ids carry characters `url()` does not like.
  const id = useId().replace(/[^\w-]/g, "");
  const { colors } = levelBadge;
  const text = levelBadgeText(level);
  const badge = (
    <svg
      className={styles.medal}
      width={size}
      height={size}
      viewBox={`0 0 ${levelBadgeBox} ${levelBadgeBox}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
          {levelBadge.rimGold.map(([color, offset]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors.faceTop} />
          <stop offset="1" stopColor={colors.faceBottom} />
        </linearGradient>
      </defs>
      <path className={styles.medalEdge} d={levelBadge.edge} fill={colors.edge} />
      <path className={styles.medalRim} d={levelBadge.rim} fill={`url(#${id}rim)`} />
      <path className={styles.medalGroove} d={levelBadge.groove} fill={colors.groove} />
      <path className={styles.medalFace} d={levelBadge.face} fill={`url(#${id}face)`} />
      <text
        className={`${styles.medalNumber} ${styles.medalLip}`}
        x={text.x}
        y={text.y + levelBadgeLip}
        fontSize={text.fontSize}
        fill={colors.inkLip}
      >
        {level}
      </text>
      <text
        className={`${styles.medalNumber} ${styles.medalInk}`}
        x={text.x}
        y={text.y}
        fontSize={text.fontSize}
        fill={colors.ink}
      >
        {level}
      </text>
    </svg>
  );
  return labelled ? (
    <span role="img" aria-label={levelLabel(level)} className={styles.medalLabelled}>
      {badge}
    </span>
  ) : (
    badge
  );
}

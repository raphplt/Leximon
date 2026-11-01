import { engravings, type IconName, iconGrid, iconStroke, icons } from "@leximon/tokens";
import styles from "./ui.module.css";

export type { IconName };

/** Decorative by default: the control that holds an icon carries the accessible name. */
export function Icon({
  name,
  size = 24,
  className,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly className?: string | undefined;
}) {
  const { shade, hatch } = engravings[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${iconGrid} ${iconGrid}`}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <path
        className={styles.iconLine}
        d={icons[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth={iconStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {shade !== undefined && (
        <path className={styles.iconShade} d={shade} fill="none" stroke="currentColor" />
      )}
      {hatch !== undefined && (
        <path className={styles.iconHatch} d={hatch} fill="none" stroke="currentColor" />
      )}
    </svg>
  );
}

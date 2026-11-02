import { type IconName, iconGrid, iconStroke, icons } from "@leximon/tokens";

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
        d={icons[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth={iconStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

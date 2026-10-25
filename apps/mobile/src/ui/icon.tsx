import { type IconName, iconGrid, iconStroke, icons } from "@leximon/tokens";
import Svg, { Path } from "react-native-svg";

/** Decorative: the control that holds an icon carries the accessible name. */
export function Icon({
  name,
  size = 24,
  color,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${iconGrid} ${iconGrid}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={icons[name]}
        fill="none"
        stroke={color}
        strokeWidth={iconStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

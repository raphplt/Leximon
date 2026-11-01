import {
  engravingStroke,
  engravings,
  type IconName,
  iconGrid,
  iconStroke,
  icons,
} from "@leximon/tokens";
import Svg, { Path } from "react-native-svg";
import { SHOWS_THEME_CHOICE } from "@/theme";

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
  const { shade, hatch } = engravings[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${iconGrid} ${iconGrid}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {SHOWS_THEME_CHOICE ? (
        <>
          <Path
            d={icons[name]}
            fill="none"
            stroke={color}
            strokeWidth={engravingStroke.line}
            strokeLinecap="square"
          />
          {shade !== undefined && (
            <Path
              d={shade}
              fill="none"
              stroke={color}
              strokeWidth={engravingStroke.shade}
              strokeLinecap="square"
            />
          )}
          {hatch !== undefined && (
            <Path d={hatch} fill="none" stroke={color} strokeWidth={engravingStroke.hatch} />
          )}
        </>
      ) : (
        <Path
          d={icons[name]}
          fill="none"
          stroke={color}
          strokeWidth={iconStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

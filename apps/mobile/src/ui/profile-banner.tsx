import type { ProfileBanner as Banner } from "@leximon/contract";
import {
  type BannerShape,
  bannerInks,
  bannerMotif,
  bannerRelief,
  bannerTint,
} from "@leximon/tokens";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";

function paint(shape: BannerShape) {
  return {
    fill: shape.fill === undefined ? "none" : bannerInks[shape.fill],
    ...(shape.stroke === undefined
      ? {}
      : { stroke: bannerInks[shape.stroke], strokeWidth: shape.strokeWidth ?? 1 }),
  };
}

/** The cloth at the top of a profile: the tint, the motif repeated over it, then its relief. */
export function ProfileBanner({
  banner,
  style,
}: {
  readonly banner: Banner;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const motif = bannerMotif(banner.motif);
  return (
    <View style={style} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="motif"
            patternUnits="userSpaceOnUse"
            width={motif.tile.width}
            height={motif.tile.height}
          >
            {motif.shapes.map((shape) => (
              <Path key={shape.d} d={shape.d} opacity={shape.opacity} {...paint(shape)} />
            ))}
          </Pattern>
          <LinearGradient id="relief" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={bannerRelief.top.color}
              stopOpacity={bannerRelief.top.opacity}
            />
            <Stop offset="0.45" stopColor={bannerRelief.top.color} stopOpacity={0} />
            <Stop
              offset="1"
              stopColor={bannerRelief.bottom.color}
              stopOpacity={bannerRelief.bottom.opacity}
            />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={bannerTint(banner.tint)} />
        <Rect width="100%" height="100%" fill="url(#motif)" />
        <Rect width="100%" height="100%" fill="url(#relief)" />
      </Svg>
    </View>
  );
}

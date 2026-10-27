import { levelBadge, levelBadgeBox, levelBadgeInkRing, levelBadgeText } from "@leximon/tokens";
import { levelLabel } from "@leximon/view-model";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "@/theme";

const clamp = (ratio: number) => Math.min(1, Math.max(0, ratio));

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
  const { colors: badge } = levelBadge;
  const text = levelBadgeText(level);
  const number = {
    x: text.x,
    y: text.y,
    fontSize: text.fontSize,
    fontFamily: fonts.display,
    textAnchor: "middle" as const,
  };
  return (
    <View
      style={{ width: size, height: size }}
      {...(labelled
        ? {
            accessible: true,
            accessibilityRole: "image" as const,
            accessibilityLabel: levelLabel(level),
          }
        : { importantForAccessibility: "no-hide-descendants" as const })}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${levelBadgeBox} ${levelBadgeBox}`}>
        <Defs>
          <LinearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={badge.rimTop} />
            <Stop offset="1" stopColor={badge.rimBottom} />
          </LinearGradient>
          <LinearGradient id="face" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={badge.faceTop} />
            <Stop offset="1" stopColor={badge.faceBottom} />
          </LinearGradient>
        </Defs>
        <Path d={levelBadge.outline} fill={badge.outline} />
        <Path d={levelBadge.rim} fill="url(#rim)" />
        <Path d={levelBadge.seam} fill={badge.seam} />
        <Path d={levelBadge.face} fill="url(#face)" />
        <Path d={levelBadge.gloss} fill={badge.gloss} />
        {/* The ring first, the white over it: react-native-svg has no paint order. */}
        <SvgText
          {...number}
          fill={badge.inkRing}
          stroke={badge.inkRing}
          strokeWidth={levelBadgeInkRing}
          strokeLinejoin="round"
        >
          {level}
        </SvgText>
        <SvgText {...number} fill={badge.ink}>
          {level}
        </SvgText>
      </Svg>
    </View>
  );
}

/** The XP bar of the level, gold on a dark well. */
export function XpBar({
  ratio,
  thin = false,
}: {
  readonly ratio: number;
  readonly thin?: boolean;
}) {
  const height = thin ? 9 : 16;
  return (
    <View style={[styles.well, { height }]}>
      <View style={[styles.fill, { width: `${Math.round(clamp(ratio) * 100)}%` }]}>
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id="xp" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFE07A" />
              <Stop offset="1" stopColor="#F2B829" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={height} fill="url(#xp)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  well: { borderRadius: 999, backgroundColor: colors.well, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999, overflow: "hidden" },
});

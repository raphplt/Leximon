import { levelBadge, levelBadgeBox, levelBadgeLip, levelBadgeText } from "@leximon/tokens";
import { levelLabel } from "@leximon/view-model";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { SHOWS_THEME_CHOICE as BOOK, colors, fonts, radii } from "@/theme";

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
      {BOOK ? (
        <Svg width={size} height={size} viewBox={`0 0 ${levelBadgeBox} ${levelBadgeBox}`}>
          <Path d={levelBadge.rim} fill={colors.gilt} />
          <Path d={levelBadge.groove} fill={colors.bindingDeep} />
          <SvgText {...number} fill={colors.giltLight}>
            {level}
          </SvgText>
        </Svg>
      ) : (
        <Svg width={size} height={size} viewBox={`0 0 ${levelBadgeBox} ${levelBadgeBox}`}>
          <Defs>
            <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              {levelBadge.rimGold.map(([color, offset]) => (
                <Stop key={offset} offset={offset} stopColor={color} />
              ))}
            </LinearGradient>
            <LinearGradient id="face" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={badge.faceTop} />
              <Stop offset="1" stopColor={badge.faceBottom} />
            </LinearGradient>
          </Defs>
          <Path d={levelBadge.edge} fill={badge.edge} />
          <Path d={levelBadge.rim} fill="url(#rim)" />
          <Path d={levelBadge.groove} fill={badge.groove} />
          <Path d={levelBadge.face} fill="url(#face)" />
          <SvgText {...number} y={number.y + levelBadgeLip} fill={badge.inkLip}>
            {level}
          </SvgText>
          <SvgText {...number} fill={badge.ink}>
            {level}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

/** The XP bar of the level, gold on a dark well. */
export function XpBar({
  ratio,
  thin = false,
  onBinding = false,
}: {
  readonly ratio: number;
  readonly thin?: boolean;
  /** On leather, where the well of a page would look lit from inside. */
  readonly onBinding?: boolean;
}) {
  const height = BOOK ? (thin ? 4 : 6) : thin ? 9 : 16;
  const width = `${Math.round(clamp(ratio) * 100)}%` as const;
  if (BOOK) {
    return (
      <View style={[styles.well, { height }, onBinding && styles.wellOnBinding]}>
        <View style={[styles.flat, { width }]} />
      </View>
    );
  }
  return (
    <View style={[styles.well, { height }]}>
      <View style={[styles.fill, { width }]}>
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id="xp" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.xpLight} />
              <Stop offset="1" stopColor={colors.xpDeep} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={height} fill="url(#xp)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  well: { borderRadius: radii.pill, backgroundColor: colors.well, overflow: "hidden" },
  wellOnBinding: { backgroundColor: colors.bindingDeep },
  fill: { height: "100%", borderRadius: radii.pill, overflow: "hidden" },
  flat: { height: "100%", backgroundColor: colors.gilt },
});

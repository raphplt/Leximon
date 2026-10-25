import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors, fonts } from "@/theme";

const clamp = (ratio: number) => Math.min(1, Math.max(0, ratio));

/** The red level medal, the one look of the level everywhere. */
export function LevelMedal({ level, size }: { readonly level: number; readonly size: number }) {
  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="medal" cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor="#FF8A65" />
            <Stop offset="0.55" stopColor={colors.badge} />
            <Stop offset="1" stopColor={colors.sealDark} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#medal)" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1}
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth={2}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.medalText, { fontSize: Math.round(size * 0.44) }]}>{level}</Text>
      </View>
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

/** A ring around the avatar: the share of the level already earned, in gold. */
export function LevelRing({
  ratio,
  size,
  width = 3,
}: {
  readonly ratio: number;
  readonly size: number;
  readonly width?: number;
}) {
  const r = (size - width) / 2;
  const length = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.track}
        strokeWidth={width}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.accent}
        strokeWidth={width}
        fill="none"
        strokeDasharray={`${length * clamp(ratio)} ${length}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  medalText: { fontFamily: fonts.display, color: "#FFF4E8", includeFontPadding: false },
  well: { borderRadius: 999, backgroundColor: colors.well, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999, overflow: "hidden" },
});

import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { toyFace } from "./toy";

/** A row of tabs, each a toy of paper, the one chosen in gold: one choice among a few views. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  light = false,
  wrap = false,
}: {
  /** `badge`: a word pinned to the tab's corner, such as « Nouveau ». */
  readonly options: readonly {
    readonly value: T;
    readonly label: string;
    readonly badge?: string | undefined;
  }[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  /** A smaller row without its pill, for a navigation above another one. */
  readonly light?: boolean;
  /** Tabs too many to hold on one line go on a second rather than lose their words. */
  readonly wrap?: boolean;
}) {
  return (
    <View
      style={[styles.row, light && styles.rowLight, styles.rowToys, wrap && styles.rowWrap]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              option.badge === undefined ? option.label : `${option.label}, ${option.badge}`
            }
            style={[
              styles.tab,
              light && styles.tabLight,
              selected && (light ? styles.tabOnLight : styles.tabOn),
              styles.toy,
              toyFace(selected ? "gold" : "paper"),
            ]}
          >
            <Text
              style={[
                styles.label,
                light && styles.labelLight,
                selected && (light ? styles.labelOnLight : styles.labelOn),
                selected ? styles.labelGold : styles.labelPaper,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && <TabBadge label={option.badge} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A sticker on a tab's corner that wiggles now and then, then rests; still when motion is reduced. */
function TabBadge({ label }: { readonly label: string }) {
  const reduced = useReducedMotion();
  const wiggle = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const swing = (to: number, duration: number) =>
      withTiming(to, { duration, easing: Easing.inOut(Easing.sin) });
    wiggle.value = withRepeat(
      withDelay(2000, withSequence(swing(-1, 160), swing(1, 170), swing(-0.4, 160), swing(0, 140))),
      -1,
    );
    return () => cancelAnimation(wiggle);
  }, [reduced, wiggle]);

  const moving = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${6 + 9 * wiggle.value}deg` },
      { scale: 1 + 0.12 * Math.abs(wiggle.value) },
    ],
  }));

  return <Animated.Text style={[styles.badge, moving]}>{label}</Animated.Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    padding: space.s2,
    gap: space.s2,
    borderRadius: radii.x4,
    backgroundColor: colors.well,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: space.s4,
    borderRadius: radii.x3,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.pageRaised },
  label: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: colors.pageInkMuted },
  labelOn: { color: colors.pageInk },
  rowLight: { padding: 0, backgroundColor: "transparent" },
  tabLight: { paddingHorizontal: space.s1 },
  tabOnLight: { backgroundColor: alpha(colors.gilt, 0.14) },
  labelLight: { fontSize: fontSizes.label },
  labelOnLight: { color: colors.rubric },
  rowToys: { padding: 0, gap: space.s4, backgroundColor: "transparent" },
  rowWrap: { flexWrap: "wrap" },
  // Each tab as wide as its words, the room left shared out.
  toy: {
    flex: 0,
    flexBasis: "auto",
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: space.s5,
    marginBottom: 3,
  },
  labelPaper: { fontFamily: fonts.ui.extrabold, color: paperColors.pageInk },
  labelGold: { fontFamily: fonts.ui.extrabold, color: toyValues.outline },
  badge: {
    position: "absolute",
    top: -8,
    right: -5,
    overflow: "hidden",
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.alert.top,
    color: colors.inkOnColor,
    fontFamily: fonts.ui.extrabold,
    fontSize: 10,
    lineHeight: 14,
  },
});

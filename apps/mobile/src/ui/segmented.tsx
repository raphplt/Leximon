import { toy as toyValues } from "@leximon/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { NewBadge } from "./new-badge";
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
              options.length >= 4 && styles.toyCompact,
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
              numberOfLines={wrap ? 2 : 1}
              adjustsFontSizeToFit={!wrap}
              minimumFontScale={0.82}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && <NewBadge label={option.badge} />}
          </Pressable>
        );
      })}
    </View>
  );
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
  toyCompact: { paddingHorizontal: space.s3 },
  labelPaper: { fontFamily: fonts.ui.extrabold, color: paperColors.pageInk },
  labelGold: { fontFamily: fonts.ui.extrabold, color: toyValues.outline },
});

import { toy as toyValues } from "@leximon/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, radii, space } from "@/theme";
import { toyFace } from "./toy";

/** A row of tabs inside one pill: one choice among a few views of a screen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  light = false,
}: {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  /** A smaller row without its pill, for a navigation above another one. */
  readonly light?: boolean;
}) {
  // In « La Bibliothèque », each tab is a toy of paper, the one chosen in gold.
  const toys = IS_LIBRARY && !light;
  return (
    <View
      style={[styles.row, light && styles.rowLight, toys && styles.rowToys]}
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
            style={[
              styles.tab,
              light && styles.tabLight,
              selected && (light ? styles.tabOnLight : styles.tabOn),
              toys && [styles.toy, toyFace(selected ? "gold" : "paper")],
            ]}
          >
            <Text
              style={[
                styles.label,
                light && styles.labelLight,
                selected && (light ? styles.labelOnLight : styles.labelOn),
                toys && (selected ? styles.labelGold : styles.labelPaper),
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
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
});

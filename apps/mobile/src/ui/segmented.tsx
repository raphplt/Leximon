import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, SHOWS_THEME_CHOICE as BOOK, colors, fontSizes, fonts, radii, space } from "@/theme";

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
  return (
    <View style={[styles.row, light && styles.rowLight]} accessibilityRole="tablist">
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
            ]}
          >
            <Text
              style={[
                styles.label,
                light && styles.labelLight,
                selected && (light ? styles.labelOnLight : styles.labelOn),
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
  row: BOOK
    ? {
        flexDirection: "row",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.rule,
        borderRadius: radii.x4,
      }
    : {
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
  tabOn: { backgroundColor: BOOK ? colors.pageInk : colors.pageRaised },
  label: {
    fontFamily: BOOK ? fonts.ui.medium : fonts.ui.bold,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
  },
  labelOn: { color: BOOK ? colors.page : colors.pageInk },
  // The light row is the tabs of a screen: in Le Livre, small capitals on a rule.
  rowLight: BOOK
    ? {
        padding: 0,
        borderWidth: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderRadius: 0,
      }
    : { padding: 0, backgroundColor: "transparent" },
  tabLight: { paddingHorizontal: space.s1 },
  tabOnLight: BOOK
    ? { borderBottomWidth: 2, borderBottomColor: colors.rubric, backgroundColor: "transparent" }
    : { backgroundColor: alpha(colors.gilt, 0.14) },
  labelLight: BOOK
    ? { fontSize: fontSizes.body, fontVariant: ["small-caps"], letterSpacing: 0.6 }
    : { fontSize: fontSizes.label },
  labelOnLight: { color: BOOK ? colors.pageInk : colors.rubric },
});

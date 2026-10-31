import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

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
  row: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 22,
    backgroundColor: colors.well,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.backgroundRaised },
  label: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.textMuted },
  labelOn: { color: colors.text },
  rowLight: { padding: 0, backgroundColor: "transparent" },
  tabLight: { paddingHorizontal: 2 },
  tabOnLight: { backgroundColor: "rgba(255, 210, 77, 0.14)" },
  labelLight: { fontSize: 14 },
  labelOnLight: { color: colors.accent },
});

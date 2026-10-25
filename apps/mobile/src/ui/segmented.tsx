import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

/** A row of tabs inside one pill: one choice among a few views of a screen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabOn]}
          >
            <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
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
});

import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts } from "@/theme";

/** A small pill: a filter or a choice among a few, gold once picked. */
export function Chip({
  label,
  on = false,
  disabled = false,
  onPress,
}: {
  readonly label: string;
  readonly on?: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={[styles.chip, on && styles.on, disabled && styles.disabled]}
    >
      <Text style={[styles.text, on && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: "center",
    backgroundColor: colors.backgroundRaised,
  },
  on: { backgroundColor: colors.accent },
  disabled: { opacity: 0.45 },
  text: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.text },
  textOn: { color: colors.accentInk },
});

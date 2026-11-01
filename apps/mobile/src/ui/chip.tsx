import { Pressable, StyleSheet, Text } from "react-native";
import { SHOWS_THEME_CHOICE as BOOK, colors, fontSizes, fonts, radii, space } from "@/theme";

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
    paddingHorizontal: space.s7,
    borderRadius: radii.x3,
    justifyContent: "center",
    ...(BOOK
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.rule }
      : { backgroundColor: colors.pageRaised }),
  },
  on: { backgroundColor: BOOK ? colors.pageInk : colors.action },
  disabled: { opacity: 0.45 },
  text: {
    fontFamily: BOOK ? fonts.ui.medium : fonts.ui.bold,
    fontSize: fontSizes.label,
    color: colors.pageInk,
  },
  textOn: { color: BOOK ? colors.page : colors.actionInk },
});

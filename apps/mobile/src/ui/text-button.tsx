import { Pressable, StyleSheet, Text } from "react-native";
import { SHOWS_THEME_CHOICE as BOOK, colors, fontSizes, fonts, space } from "@/theme";

/** A minor action, written as an underlined link. */
export function TextButton({
  label,
  onPress,
  disabled = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dim]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "center", paddingVertical: space.s4 },
  dim: { opacity: 0.5 },
  label: {
    fontFamily: BOOK ? fonts.text.italic : fonts.ui.bold,
    fontSize: fontSizes.body,
    color: colors.rubric,
    textDecorationLine: "underline",
  },
});

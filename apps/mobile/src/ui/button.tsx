import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts } from "@/theme";

/** The gold button of the main action, raised on its darker edge; `secondary` is outlined. */
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        pressed && !secondary && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: secondary ? colors.text : colors.accentInk }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accent,
    borderBottomWidth: 4,
    borderBottomColor: colors.accentShadow,
  },
  secondary: { borderWidth: 2, borderColor: colors.track },
  pressed: { borderBottomWidth: 1, marginTop: 3 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.ui.extrabold, fontSize: 16 },
});

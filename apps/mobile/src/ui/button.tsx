import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, fonts, space } from "@/theme";

/**
 * The gold button of the main action, raised on its darker edge; `secondary` is outlined, and
 * `danger` outlined in the warning colour, for what cannot be undone.
 */
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly secondary?: boolean;
  readonly danger?: boolean;
}) {
  const outlined = secondary || danger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        danger ? styles.danger : outlined ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        pressed && !outlined && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: danger ? colors.danger : outlined ? colors.pageInk : colors.actionInk },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: space.s12,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.action,
    borderBottomWidth: 4,
    borderBottomColor: colors.actionEdge,
  },
  secondary: { borderWidth: 2, borderColor: colors.track },
  danger: { borderWidth: 2, borderColor: colors.danger },
  pressed: { borderBottomWidth: 1, marginTop: 3 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.bodyLarge },
});

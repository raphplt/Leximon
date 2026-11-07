import { Pressable, StyleSheet, Text } from "react-native";
import { fontSizes, fonts, space } from "@/theme";
import { useInk } from "./ink";

/** A minor action, written as an underlined link. */
export function TextButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** When the label alone does not say what the button acts on. */
  readonly accessibilityLabel?: string;
}) {
  const ink = useInk();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.label, { color: ink.rubric }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "center", paddingVertical: space.s4 },
  dim: { opacity: 0.5 },
  label: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    textDecorationLine: "underline",
  },
});

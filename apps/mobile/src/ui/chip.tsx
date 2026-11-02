import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, fonts, IS_LIBRARY, paperColors, radii, space } from "@/theme";
import { toyFace } from "./toy";

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
      style={[
        styles.chip,
        on && styles.on,
        IS_LIBRARY && [styles.toy, toyFace(on ? "gold" : "paper", "tag")],
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, IS_LIBRARY && styles.textOnPaper, on && styles.textOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: space.s7,
    borderRadius: radii.x3,
    justifyContent: "center",
    backgroundColor: colors.pageRaised,
  },
  on: { backgroundColor: colors.action },
  disabled: { opacity: 0.45 },
  text: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: colors.pageInk },
  textOn: { color: colors.actionInk },
  toy: { marginBottom: 2 },
  textOnPaper: { color: paperColors.pageInk },
});

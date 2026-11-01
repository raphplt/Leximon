import { useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { alpha, SHOWS_THEME_CHOICE as BOOK, colors, fontSizes, fonts, radii, space } from "@/theme";

/** A labelled field; `large` spaces out a short code. */
export function TextField({
  label,
  large = false,
  ...input
}: Omit<TextInputProps, "style"> & { readonly label: string; readonly large?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label} importantForAccessibility="no">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.pageInkFaint}
        selectionColor={colors.rubric}
        cursorColor={colors.rubric}
        {...input}
        onFocus={(event) => {
          setFocused(true);
          input.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          input.onBlur?.(event);
        }}
        style={[styles.input, large && styles.large, focused && styles.focused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.s4 },
  label: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: colors.pageInkMuted },
  input: {
    minHeight: 52,
    paddingHorizontal: space.s8,
    borderRadius: radii.xl,
    borderWidth: BOOK ? 1 : 2,
    borderColor: BOOK ? colors.rule : colors.track,
    backgroundColor: BOOK ? alpha(colors.panel, 0.6) : colors.well,
    color: colors.pageInk,
    fontFamily: BOOK ? fonts.text.regular : fonts.ui.semibold,
    fontSize: fontSizes.lead,
  },
  large: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.titleLarge,
    letterSpacing: 10,
    textAlign: "center",
  },
  focused: { borderColor: BOOK ? colors.pageInk : colors.gilt },
});

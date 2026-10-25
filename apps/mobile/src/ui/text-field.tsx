import { useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { colors, fonts } from "@/theme";

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
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
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
  field: { gap: 8 },
  label: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.textMuted },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.well,
    color: colors.text,
    fontFamily: fonts.ui.semibold,
    fontSize: 17,
  },
  large: { fontFamily: fonts.ui.extrabold, fontSize: 26, letterSpacing: 10, textAlign: "center" },
  focused: { borderColor: colors.accent },
});

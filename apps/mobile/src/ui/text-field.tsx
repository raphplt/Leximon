import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { fontSizes, fonts, IS_LIBRARY, radii, space } from "@/theme";
import { useInk } from "./ink";

/** A labelled field; `large` spaces out a short code. */
export function TextField({
  label,
  large = false,
  ...input
}: Omit<TextInputProps, "style"> & { readonly label: string; readonly large?: boolean }) {
  const [focused, setFocused] = useState(false);
  const ink = useInk();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: ink.pageInkMuted }]} importantForAccessibility="no">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={ink.pageInkFaint}
        selectionColor={ink.rubric}
        cursorColor={ink.rubric}
        {...input}
        onFocus={(event) => {
          setFocused(true);
          input.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          input.onBlur?.(event);
        }}
        style={[
          styles.input,
          { borderColor: ink.track, backgroundColor: ink.well, color: ink.pageInk },
          IS_LIBRARY && styles.pressedIn,
          focused && { borderColor: ink.gilt },
          large && styles.large,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.s4 },
  label: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label },
  input: {
    minHeight: 52,
    paddingHorizontal: space.s8,
    borderRadius: radii.xl,
    borderWidth: 2,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.lead,
  },
  large: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.titleLarge,
    letterSpacing: 10,
    textAlign: "center",
  },
  // In « La Bibliothèque », a field is pressed into the paper, under its dark outline.
  pressedIn: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.paper.top,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
});

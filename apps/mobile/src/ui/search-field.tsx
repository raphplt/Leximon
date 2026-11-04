import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { StyleSheet, TextInput, View } from "react-native";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Icon } from "./icon";

/** A field to search a list by its first letters, a magnifier before it. */
export function SearchField({
  value,
  label,
  onChange,
  maxLength,
  compact = false,
}: {
  readonly value: string;
  /** Shown in the empty field, and read out. */
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly maxLength?: number;
  /** A smaller field, inside a panel. */
  readonly compact?: boolean;
}) {
  return (
    <View style={[styles.field, compact && styles.compact, styles.paper]}>
      <Icon name="search" size={compact ? 17 : 18} color={ink.pageInkMuted} />
      <TextInput
        style={[styles.input, compact && styles.inputCompact, { color: ink.pageInk }]}
        value={value}
        {...(maxLength === undefined ? {} : { maxLength })}
        placeholder={label}
        placeholderTextColor={ink.pageInkFaint}
        selectionColor={ink.rubric}
        accessibilityLabel={label}
        autoCorrect={false}
        autoCapitalize="none"
        onChangeText={onChange}
      />
    </View>
  );
}

/** The field is cut into paper, wherever it lies. */
const ink = paperColors;

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    minHeight: 50,
    paddingHorizontal: space.s8,
    borderRadius: 25,
  },
  compact: { minHeight: 46, paddingHorizontal: space.s7, borderRadius: 23 },
  paper: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: paperColors.paper,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
  input: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    paddingVertical: space.s5,
  },
  inputCompact: { fontSize: fontSizes.body, paddingVertical: space.s4 },
});

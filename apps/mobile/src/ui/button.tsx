import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, SHOWS_THEME_CHOICE as BOOK, colors, fontSizes, fonts, space } from "@/theme";
import { Matter } from "./matter";

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
        disabled && (BOOK ? styles.unavailable : styles.disabled),
        pressed && !outlined && (BOOK ? styles.sunk : styles.pressed),
      ]}
    >
      {BOOK && !outlined && !disabled && <Matter kind="leather" />}
      {BOOK && !disabled && (
        <View
          style={[
            styles.inset,
            { borderColor: outlined ? colors.rule : alpha(colors.actionInk, 0.55) },
          ]}
        />
      )}
      <Text
        {...(BOOK ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75 } : {})}
        style={[
          styles.label,
          {
            color: danger
              ? colors.danger
              : outlined
                ? colors.pageInk
                : BOOK && disabled
                  ? colors.pageInkMuted
                  : colors.actionInk,
          },
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
    borderRadius: BOOK ? 0 : 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primary: BOOK
    ? { backgroundColor: colors.action }
    : {
        backgroundColor: colors.action,
        borderBottomWidth: 4,
        borderBottomColor: colors.actionEdge,
      },
  secondary: BOOK
    ? { borderWidth: 1, borderColor: colors.pageInk }
    : { borderWidth: 2, borderColor: colors.track },
  danger: { borderWidth: BOOK ? 1 : 2, borderColor: colors.danger },
  pressed: { borderBottomWidth: 1, marginTop: 3 },
  sunk: { backgroundColor: colors.actionDeep },
  disabled: { opacity: 0.45 },
  unavailable: { backgroundColor: colors.track },
  /** The fine rule inside the edge of a bound button. */
  inset: {
    position: "absolute",
    top: space.s1,
    right: space.s1,
    bottom: space.s1,
    left: space.s1,
    borderWidth: 1,
  },
  label: BOOK
    ? {
        fontFamily: fonts.ui.semibold,
        fontSize: fontSizes.bodyLarge,
        fontVariant: ["small-caps"],
        letterSpacing: 1,
      }
    : { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.bodyLarge },
});

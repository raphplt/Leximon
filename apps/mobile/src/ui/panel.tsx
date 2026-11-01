import { StyleSheet, View, type ViewProps } from "react-native";
import { alpha, SHOWS_THEME_CHOICE as BOOK, colors, space } from "@/theme";
import { Frame } from "./ornament";

/** A block of a screen, raised on the background; `framed` gives it the printed frame. */
export function Panel({
  framed = false,
  style,
  ...view
}: ViewProps & { readonly framed?: boolean }) {
  if (framed && BOOK) return <Frame {...view} style={[styles.framed, style]} />;
  return <View {...view} style={[styles.panel, style]} />;
}

const styles = StyleSheet.create({
  panel: BOOK
    ? {
        padding: space.s9,
        gap: space.s6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.rule,
        borderRadius: 2,
        backgroundColor: alpha(colors.panel, 0.72),
      }
    : { padding: space.s9, gap: space.s6, borderRadius: 20, backgroundColor: colors.panel },
  framed: { padding: space.s16, gap: space.s6, backgroundColor: alpha(colors.panel, 0.72) },
});

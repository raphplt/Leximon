import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, space } from "@/theme";

/** A block of a screen, raised on the background. */
export function Panel({ style, ...view }: ViewProps) {
  return <View {...view} style={[styles.panel, style]} />;
}

const styles = StyleSheet.create({
  panel: { padding: space.s9, gap: space.s6, borderRadius: 20, backgroundColor: colors.panel },
});

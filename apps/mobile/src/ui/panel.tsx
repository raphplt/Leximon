import { StyleSheet, View, type ViewProps } from "react-native";
import { colors } from "@/theme";

/** A block of a screen, raised on the background. */
export function Panel({ style, ...view }: ViewProps) {
  return <View {...view} style={[styles.panel, style]} />;
}

const styles = StyleSheet.create({
  panel: { padding: 18, gap: 12, borderRadius: 20, backgroundColor: colors.panel },
});

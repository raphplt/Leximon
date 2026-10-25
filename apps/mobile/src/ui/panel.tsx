import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "@/theme";

/** A block of a screen, raised on the background. */
export function Panel({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: { padding: 18, gap: 12, borderRadius: 20, backgroundColor: colors.panel },
});

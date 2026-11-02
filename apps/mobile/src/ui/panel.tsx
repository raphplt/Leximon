import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, IS_LIBRARY, space } from "@/theme";
import { Leaf } from "./toy";

/**
 * A block of a screen, raised on the background. A `paper` panel is a leaf of paper in « La
 * Bibliothèque »: what it holds then reads in `paperColors`.
 */
export function Panel({
  paper = false,
  style,
  children,
  ...view
}: ViewProps & { readonly paper?: boolean }) {
  if (IS_LIBRARY && paper)
    return <Leaf style={[styles.panel, styles.leaf, style]}>{children}</Leaf>;
  return (
    <View {...view} style={[styles.panel, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: space.s9, gap: space.s6, borderRadius: 20, backgroundColor: colors.panel },
  leaf: { borderRadius: 18, backgroundColor: colors.paper },
});

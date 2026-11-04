import { toy as toyValues } from "@leximon/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, space } from "@/theme";
import { Leaf } from "./toy";

/**
 * A block of a screen, raised on the background. A `paper` panel is a leaf of paper: what it holds
 * then reads in `paperColors`.
 */
export function Panel({
  paper = false,
  style,
  children,
  ...view
}: ViewProps & { readonly paper?: boolean }) {
  if (paper) return <Leaf style={[styles.panel, styles.leaf, style]}>{children}</Leaf>;
  return (
    <View {...view} style={[styles.panel, style]}>
      {children}
    </View>
  );
}

/** How much a leaf laid by `OnPaper` takes from the width of what it holds, on each side. */
export const ON_PAPER_INSET = space.s9 + toyValues.outlineWidth;

/** A leaf of paper under what a screen lays straight on the page (a form, the facts of a card). */
export function OnPaper({ children }: { readonly children: ReactNode }) {
  return <Leaf style={styles.sheet}>{children}</Leaf>;
}

const styles = StyleSheet.create({
  panel: { padding: space.s9, gap: space.s6, borderRadius: 20, backgroundColor: colors.panel },
  leaf: { borderRadius: 18, backgroundColor: colors.paper },
  sheet: { padding: space.s9, gap: space.s8 },
});

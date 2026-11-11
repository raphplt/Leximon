import { toy as toyValues } from "@leximon/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, space } from "@/theme";
import { Fleurons, LEAF_PADDING } from "./ornaments";
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

/**
 * A leaf of paper under what a screen lays straight on the page (a form, the facts of a card).
 * `fleurons` frames it, for a welcome.
 */
export function OnPaper({
  children,
  fleurons = false,
}: {
  readonly children: ReactNode;
  readonly fleurons?: boolean;
}) {
  return (
    <Leaf style={[styles.sheet, fleurons && styles.illuminated]}>
      {fleurons && <Fleurons small />}
      {children}
    </Leaf>
  );
}

/** How much a leaf laid by `OnPaper` takes from the width of what it holds. */
export const ON_PAPER_INSET = space.s9 + toyValues.outlineWidth;

const styles = StyleSheet.create({
  panel: { padding: space.s9, gap: space.s6, borderRadius: 20, backgroundColor: colors.panel },
  leaf: { borderRadius: 18, backgroundColor: colors.paper },
  sheet: { padding: space.s9, gap: space.s8 },
  illuminated: { padding: LEAF_PADDING.fleurons },
});

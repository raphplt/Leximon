import { toy as toyValues } from "@leximon/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, space } from "@/theme";
import { BindingRule, Fleurons, ORNAMENT_PADDING } from "./ornaments";
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
 * `ornament` frames it: fleurons for a welcome, the binding rule for a panel the player reads.
 */
export function OnPaper({
  children,
  ornament,
}: {
  readonly children: ReactNode;
  readonly ornament?: "fleurons" | "binding";
}) {
  return (
    <Leaf style={[styles.sheet, ornament !== undefined && FRAMED[ornament]]}>
      {ornament === "fleurons" && <Fleurons small />}
      {ornament === "binding" && <BindingRule />}
      {children}
    </Leaf>
  );
}

/** How much a leaf laid by `OnPaper` in its binding rule takes from the width of what it holds. */
export const ON_BOUND_PAPER_INSET = ORNAMENT_PADDING.binding + toyValues.outlineWidth;

const FRAMED = {
  fleurons: { padding: ORNAMENT_PADDING.fleurons },
  binding: { padding: ORNAMENT_PADDING.binding },
} as const;

const styles = StyleSheet.create({
  panel: { padding: space.s9, gap: space.s6, borderRadius: 20, backgroundColor: colors.panel },
  leaf: { borderRadius: 18, backgroundColor: colors.paper },
  sheet: { padding: space.s9, gap: space.s8 },
});

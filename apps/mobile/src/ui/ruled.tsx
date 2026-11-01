import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, space } from "@/theme";

/** A row of a list set apart by a fine rule, as in a dictionary. */
export function RuledRow({
  last = false,
  children,
}: {
  readonly last?: boolean;
  readonly children: ReactNode;
}) {
  return <View style={[styles.row, !last && styles.rule]}>{children}</View>;
}

const DOTS = ". ".repeat(90);

/**
 * A label and its value, joined by a line of dots, as in a table of contents. The dots are text:
 * Android does not draw a dotted border on one side only.
 */
export function Leader({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.leader} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.dots} numberOfLines={1} ellipsizeMode="clip">
        {DOTS}
      </Text>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.s6 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  leader: { flexDirection: "row", alignItems: "baseline", gap: space.s3 },
  text: { fontFamily: fonts.text.regular, fontSize: fontSizes.body, color: colors.pageInk },
  dots: {
    flex: 1,
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.caption,
    color: colors.pageInkMuted,
  },
});

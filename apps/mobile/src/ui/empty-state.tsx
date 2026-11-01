import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Plate } from "./ornament";

/** A list with nothing in it yet: a sentence that says so, and what to do next if anything. */
export function EmptyState({
  message,
  action,
}: {
  readonly message: string;
  readonly action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Plate name="f06" width={132} color={colors.pageInkMuted} />
      <Text style={styles.text}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: space.s6, paddingVertical: space.s16 },
  text: {
    maxWidth: 280,
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 23,
    textAlign: "center",
    color: colors.pageInkMuted,
  },
});

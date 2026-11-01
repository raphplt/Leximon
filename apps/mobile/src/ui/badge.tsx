import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "@/theme";

/** The red count of what waits for the player, ringed with the colour behind it. */
export function Badge({ count, ring }: { readonly count: number; readonly ring: string }) {
  return (
    <View style={[styles.badge, { borderColor: ring }]} importantForAccessibility="no">
      <Text style={styles.text}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    borderWidth: 2,
    backgroundColor: colors.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    color: colors.inkOnColor,
    includeFontPadding: false,
  },
});

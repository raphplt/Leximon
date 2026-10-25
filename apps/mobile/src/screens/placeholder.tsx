import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

/** A tab whose screen is not built on mobile yet. */
export function Placeholder({ title }: { readonly title: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text },
});

import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

export default function Invitation() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sur invitation.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
});

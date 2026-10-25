import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";
import { TextButton } from "@/ui/text-button";

/** For a player who already has an account: the closed beta lets members in. */
export function SignInLink() {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>Déjà un compte ?</Text>
      <TextButton label="Me connecter" onPress={() => router.push("/compte")} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  text: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.textMuted },
});

import { SIGN_IN_QUERY } from "@leximon/view-model";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { fontSizes, fonts, space } from "@/theme";
import { useInk } from "@/ui/ink";
import { TextButton } from "@/ui/text-button";

/** For a player who already has an account: the closed beta lets members in. */
export function SignInLink() {
  const ink = useInk();
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: ink.pageInkMuted }]}>Déjà un compte ?</Text>
      <TextButton
        label="Me connecter"
        onPress={() => router.push({ pathname: "/compte", params: { [SIGN_IN_QUERY]: "1" } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: space.s4,
    marginTop: space.s8,
  },
  text: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.body },
});

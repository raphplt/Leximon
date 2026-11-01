import { WAITLIST_ERRORS } from "@leximon/view-model";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { WEB_URL } from "@/config";
import { playFromScratch } from "@/player/session";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { FormError } from "@/ui/page";
import { TextField } from "@/ui/text-field";

type FormState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "joined" }
  | { readonly kind: "closed" }
  | { readonly kind: "error"; readonly message: string };

/** Leaves an address to be warned when the game opens. Nothing else is asked or promised. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const submit = async () => {
    if (state.kind === "sending" || email.trim() === "") return;
    setState({ kind: "sending" });
    try {
      const result = await api.joinWaitlist(email.trim());
      setState(
        result.kind === "refused"
          ? { kind: "error", message: WAITLIST_ERRORS[result.reason] }
          : result,
      );
    } catch {
      setState({ kind: "error", message: WAITLIST_ERRORS.unavailable });
    }
  };

  if (state.kind === "joined") {
    return (
      <Text style={styles.done} accessibilityLiveRegion="polite">
        Noté. On se revoit à l'ouverture.
      </Text>
    );
  }

  if (state.kind === "closed") {
    return (
      <View style={styles.form}>
        <Text style={styles.done} accessibilityLiveRegion="polite">
          Le jeu est ouvert.
        </Text>
        <Button label="Viens jouer" onPress={playFromScratch} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Ton adresse e-mail"
        placeholder="ton@adresse.fr"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />
      <Button
        label={state.kind === "sending" ? "Envoi…" : "Préviens-moi"}
        secondary
        disabled={state.kind === "sending" || email.trim() === ""}
        onPress={() => void submit()}
      />
      <FormError message={state.kind === "error" ? state.message : null} />
      <Text style={styles.note}>
        On t'écrit à l'ouverture, puis quand le jeu a du nouveau.{" "}
        <Text
          style={styles.link}
          accessibilityRole="link"
          onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/confidentialite`)}
        >
          Tes données
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.s6 },
  done: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: colors.success,
  },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: colors.pageInkFaint,
  },
  link: { color: colors.rubric, textDecorationLine: "underline" },
});

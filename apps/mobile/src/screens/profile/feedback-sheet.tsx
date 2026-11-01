import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { api } from "@/api/client";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { FormError } from "@/ui/page";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";

/**
 * A note to the team, marked as sent from the phone, from `screen` when it names one, such as the
 * card a mistake was spotted on. Read by us only.
 */
export function FeedbackSheet({
  open,
  onClose,
  screen = "/mobile",
  title = "Écrire à l'équipe",
  label = "Signale un bug, une erreur sur une carte ou partage une idée.",
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly screen?: `/mobile${string}`;
  readonly title?: string;
  readonly label?: string;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.sendFeedback({ body: body.trim(), screen });
      setBody("");
      onClose();
      toast("Message envoyé. Merci.");
    } catch {
      setError("L'envoi a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.field}
        value={body}
        maxLength={1000}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        selectionColor={colors.rubric}
        accessibilityLabel={label}
        onChangeText={setBody}
      />
      <Button
        label={busy ? "Envoi…" : "Envoyer"}
        disabled={busy || body.trim().length < 3}
        onPress={() => void submit()}
      />
      <FormError message={error} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInk,
  },
  field: {
    minHeight: 120,
    padding: space.s6,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.well,
    color: colors.pageInk,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
  },
});

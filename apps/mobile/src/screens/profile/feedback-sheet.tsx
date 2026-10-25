import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { api } from "@/api/client";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { FormError } from "@/ui/page";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";

const LABEL = "Un bug, une idée, un mot qui cloche : dis-le.";

/** A note to the team, marked as sent from the phone. Read by us only. */
export function FeedbackSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.sendFeedback({ body: body.trim(), screen: "/mobile" });
      setBody("");
      onClose();
      toast("Bien reçu. Merci.");
    } catch {
      setError("Pas parti. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Un retour ?" onClose={onClose}>
      <Text style={styles.label}>{LABEL}</Text>
      <TextInput
        style={styles.field}
        value={body}
        maxLength={1000}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        selectionColor={colors.accent}
        accessibilityLabel={LABEL}
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
  label: { fontFamily: fonts.ui.semibold, fontSize: 15, lineHeight: 21, color: colors.text },
  field: {
    minHeight: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.well,
    color: colors.text,
    fontFamily: fonts.ui.medium,
    fontSize: 15,
  },
});

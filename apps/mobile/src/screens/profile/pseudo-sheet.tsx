import { pseudoHint } from "@leximon/view-model";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useNow } from "@/player/shared";
import { useProfileActions } from "@/profile/profile-actions";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Sheet } from "@/ui/sheet";
import { TextField } from "@/ui/text-field";

/** Choosing or changing the pseudo: the server checks it and says why it refuses. */
export function PseudoSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const actions = useProfileActions();
  const me = actions.profile;
  const now = useNow(60_000);
  const [pseudo, setPseudo] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPseudo(me?.pseudo ?? "");
    setProblem(null);
  }, [open, me?.pseudo]);

  const locked = me?.pseudoChangeableFrom != null && Date.parse(me.pseudoChangeableFrom) > now;
  const chosen = pseudo.trim();
  const canSubmit = !locked && !actions.busy && chosen !== "" && chosen !== me?.pseudo;

  const submit = async () => {
    if (!canSubmit) return;
    const failed = await actions.update(
      { pseudo: chosen },
      { success: `Te voilà ${chosen}.`, quiet: true },
    );
    setProblem(failed);
    if (failed === null) onClose();
  };

  return (
    <Sheet open={open} title="Ton pseudo" onClose={onClose}>
      {me !== null && (
        <>
          <TextField
            label="Pseudo"
            value={pseudo}
            maxLength={20}
            editable={!locked}
            autoComplete="nickname"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            onChangeText={(text) => {
              setPseudo(text);
              setProblem(null);
            }}
            onSubmitEditing={() => void submit()}
          />
          <Text
            style={problem === null ? styles.hint : styles.problem}
            accessibilityRole={problem === null ? undefined : "alert"}
          >
            {problem ?? pseudoHint(me, now)}
          </Text>
          <Button
            label={actions.busy ? "Vérification…" : "Prendre ce pseudo"}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.ui.medium, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  problem: { fontFamily: fonts.ui.bold, fontSize: 14, lineHeight: 20, color: colors.danger },
});

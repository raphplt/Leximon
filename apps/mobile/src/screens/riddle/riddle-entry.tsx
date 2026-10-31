import type { RiddleResponse } from "@leximon/contract";
import { riddleInvitation, riddleProgressLine } from "@leximon/view-model";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { api } from "@/api/client";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Panel } from "@/ui/panel";

/** The riddle on the Défis screen, read each time the screen comes back: the game moves on elsewhere. */
export function RiddleEntry({ now }: { readonly now: number }) {
  const [riddle, setRiddle] = useState<RiddleResponse | null>(null);
  useFocusEffect(
    useCallback(() => {
      api
        .fetchRiddle()
        .then(setRiddle)
        // The riddle is an extra: the rest of the screen works without it.
        .catch(() => setRiddle(null));
    }, []),
  );
  if (riddle === null) return null;

  const started = riddle.step > 0 || riddle.outcome !== null;
  return (
    <Panel style={styles.panel}>
      <Text style={styles.title} accessibilityRole="header">
        Énigme du jour
      </Text>
      <Text style={styles.line}>
        {started ? riddleProgressLine(riddle) : riddleInvitation(riddle.lastStep, now)}
      </Text>
      <Button
        label={riddle.outcome !== null ? "Voir mon résultat" : started ? "Continuer" : "Jouer"}
        secondary={riddle.outcome !== null}
        onPress={() => router.push("/enigme")}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  line: { fontFamily: fonts.ui.medium, fontSize: 15, lineHeight: 21, color: colors.textMuted },
});

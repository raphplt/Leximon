import type { PracticeScope, PracticeSummaryResponse } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt } from "@leximon/core";
import {
  isFeatureOpen,
  PACK_NOUNS,
  PRACTICE_RULE,
  PRACTICE_THEMES_CLOSED,
  practiceEmptyLine,
  practiceView,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { useShared } from "@/player/shared";
import { progress } from "@/player/state";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
import { Panel } from "@/ui/panel";

/** Series on a scope the player picks. Read on arrival: the screen comes back after each series. */
export function PracticeSection({
  catalog,
  now,
  busy,
  onPick,
}: {
  readonly catalog: Catalog;
  readonly now: number;
  readonly busy: boolean;
  readonly onPick: (scope: PracticeScope) => void;
}) {
  const [summary, setSummary] = useState<PracticeSummaryResponse | null>(null);
  const player = useShared(progress);
  useEffect(() => {
    api
      .fetchPracticeSummary()
      .then(setSummary)
      // Practice is an extra: the rest of the screen works without it.
      .catch(() => setSummary(null));
  }, []);
  if (summary === null || player === null) return null;

  const themesOpen = isFeatureOpen("practice_choice", player.level, now);
  const view = practiceView(summary, (id) => collectionName(catalog, id), themesOpen, now);
  const choices = [...view.mine, ...view.collections, ...view.themes];
  return (
    <Panel style={styles.panel}>
      <Text style={styles.kicker} accessibilityRole="header">
        S'ENTRAÎNER
      </Text>
      {choices.length === 0 ? (
        <Text style={styles.line}>
          {practiceEmptyLine(practiceRulesAt(PRACTICE_SCHEDULE, now).minWords, PACK_NOUNS.sachet)}
        </Text>
      ) : (
        <>
          <Text style={styles.line}>{PRACTICE_RULE}</Text>
          {choices.map((choice) => (
            <Pressable
              key={choice.key}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => onPick(choice.scope)}
            >
              <View>
                <Text style={styles.label}>{choice.label}</Text>
                <Text style={styles.detail}>{choice.detail}</Text>
              </View>
            </Pressable>
          ))}
          {!themesOpen && <Text style={styles.note}>{PRACTICE_THEMES_CLOSED}</Text>}
          <Text style={styles.note}>{view.xpLine}</Text>
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.s5 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.pageInkMuted,
  },
  line: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInkMuted,
  },
  choice: {
    paddingVertical: space.s6,
    paddingHorizontal: space.s7,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radii.xl,
  },
  pressed: { borderColor: colors.gilt },
  label: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.pageInk },
  detail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: colors.pageInkMuted },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: colors.pageInkFaint,
  },
});

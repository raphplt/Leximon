import { type Catalog, cardOrPlaceholder } from "@leximon/contract/client";
import {
  type AnsweredQuestion,
  clanShareLine,
  levelUpLine,
  NOT_THIS_TIME,
  PACK_NOUNS,
  sessionBonusLine,
  sessionScore,
  sessionXpLine,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { dailyChallenge, refreshIfRead } from "@/player/collection";
import { useShared } from "@/player/shared";
import { myClan } from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";

const NOUN = PACK_NOUNS.sachet;

/** The end of a session: the score, the XP, what the clan and the daily goal got from it. */
export function ChallengeRecap({
  catalog,
  answers,
  onBack,
}: {
  readonly catalog: Catalog;
  readonly answers: readonly AnsweredQuestion[];
  readonly onBack: () => void;
}) {
  const tally = useShared(dailyChallenge);
  const clan = useShared(myClan);
  const xp = sessionXpLine(answers);
  const clanShare =
    clan?.clanId == null ? null : clanShareLine(answers.filter((answer) => answer.correct).length);
  // The clan's goal counts these answers too.
  useEffect(() => refreshIfRead(myClan), []);
  const bonus = sessionBonusLine(answers, NOUN);
  const ups = answers
    .filter((answer) => answer.levelUp)
    .map((answer) =>
      levelUpLine(cardOrPlaceholder(catalog, answer.cardId, "common").word, answer.level),
    );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Panel style={styles.recap}>
        <Text style={styles.kicker}>DÉFI TERMINÉ</Text>
        <Text style={styles.score}>{sessionScore(answers)}</Text>
        {xp !== null && <Text style={styles.xp}>{xp}</Text>}
        {clanShare !== null && (
          <View style={styles.line}>
            <Icon name="clan" size={18} color={colors.text} />
            <Text style={styles.lineText}>{clanShare}</Text>
          </View>
        )}
        {bonus !== null ? (
          <View style={styles.line}>
            <Icon name="sachet" size={26} color={colors.accent} />
            <Text style={[styles.lineText, styles.won]}>{bonus}</Text>
          </View>
        ) : (
          tally !== null && !tally.awarded && <Text style={styles.lost}>{NOT_THIS_TIME}</Text>
        )}
        {ups.map((line) => (
          <Text key={line} style={styles.up}>
            {line}
          </Text>
        ))}
        <View style={styles.actions}>
          <Button label="Retour aux défis" onPress={onBack} />
          <Button label={`Ouvrir un ${NOUN.one}`} secondary onPress={() => router.navigate("/")} />
        </View>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: TAB_BAR_RISE + 24, flexGrow: 1, justifyContent: "center" },
  recap: { alignItems: "center", gap: 12, paddingVertical: 28 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  score: { fontFamily: fonts.display, fontSize: 40, color: colors.text, textAlign: "center" },
  xp: { fontFamily: fonts.display, fontSize: 24, color: colors.accent },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  lineText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.text },
  won: { color: colors.accent },
  lost: {
    fontFamily: fonts.text.italic,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: "center",
  },
  up: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.success, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 8 },
});

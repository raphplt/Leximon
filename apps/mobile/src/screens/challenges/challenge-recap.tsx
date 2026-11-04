import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import {
  type AnsweredQuestion,
  clanAnswers,
  clanShareLine,
  climbedWords,
  comingBackLine,
  comingBackTomorrow,
  levelUpLine,
  NOT_THIS_TIME,
  PACK_NOUNS,
  RECAP_BONUS_MS,
  recapActions,
  type SeriesQuestion,
  scoredAnswers,
  sessionBonusLine,
  sessionScore,
  sessionXpLine,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, useReducedMotion } from "react-native-reanimated";
import { Card } from "@/cards/card";
import { play } from "@/feedback/feedback";
import { dailyChallenge, refreshIfRead, reviewSummary } from "@/player/collection";
import { useShared } from "@/player/shared";
import { myClan } from "@/player/state";
import { openCard } from "@/screens/trades/card-row";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";

const NOUN = PACK_NOUNS.sachet;

/** Counts from 0 up to `target` over `ms`, at once when the system asks for less motion. */
function useCountUp(target: number, ms: number): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const share = Math.min(1, (Date.now() - start) / ms);
      setShown(Math.round(target * share));
      if (share < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, reduced]);
  return shown;
}

/** A small card of the recap, which opens its sheet. */
function Thumb({
  catalog,
  cardId,
  among,
  width,
}: {
  readonly catalog: Catalog;
  readonly cardId: string;
  readonly among: readonly string[];
  readonly width: number;
}) {
  const card = cardOrPlaceholder(catalog, cardId, "common");
  return (
    <Pressable
      onPress={() => openCard(cardId, among)}
      accessibilityRole="button"
      accessibilityLabel={`Voir la carte ${card.word}`}
    >
      <View importantForAccessibility="no-hide-descendants">
        <Card
          card={card}
          collectionName={collectionName(catalog, card.collectionId)}
          width={width}
        />
      </View>
    </Pressable>
  );
}

/**
 * The end of a series: the score, the XP, the words that climbed and those coming back tomorrow,
 * what the clan and the daily goal got from it, and what to do next.
 */
export function ChallengeRecap({
  catalog,
  answers,
  series,
  busy,
  onMore,
  onBack,
}: {
  readonly catalog: Catalog;
  readonly answers: readonly AnsweredQuestion[];
  readonly series: readonly SeriesQuestion[];
  readonly busy: boolean;
  readonly onMore: () => void;
  readonly onBack: () => void;
}) {
  const tally = useShared(dailyChallenge);
  const clan = useShared(myClan);
  const summary = useShared(reviewSummary);
  const xp = sessionXpLine(answers);
  const clanShare = clan?.clanId == null ? null : clanShareLine(clanAnswers(answers));
  // The clan's goal counts these answers too; the review counts what is left.
  useEffect(() => {
    refreshIfRead(myClan);
    reviewSummary.refresh();
  }, []);
  const bonus = sessionBonusLine(answers, NOUN);
  const scored = scoredAnswers(series, answers);
  const right = useCountUp(scored.filter((answer) => answer.correct).length, 500);
  useEffect(() => {
    play("recap");
    if (bonus === null) return;
    const timer = setTimeout(() => play("chimePrecious"), RECAP_BONUS_MS);
    return () => clearTimeout(timer);
  }, [bonus]);
  const climbed = climbedWords(answers);
  const climbedIds = climbed.map((word) => word.cardId);
  const back = comingBackTomorrow(answers);
  const backLine = comingBackLine(back.length);
  const actions = recapActions(summary, summary?.settings.length ?? answers.length, NOUN);
  const more = (primary: boolean) => (
    <Button label={actions.more} secondary={!primary} disabled={busy} onPress={onMore} />
  );
  const open = (primary: boolean) => (
    <Button label={actions.open} secondary={!primary} onPress={() => router.navigate("/")} />
  );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Panel paper style={styles.recap}>
        <Text style={styles.kicker}>RÉVISION TERMINÉE</Text>
        <Text style={styles.score} accessibilityLabel={sessionScore(scored)}>
          {right}/{scored.length}
        </Text>
        {xp !== null && <Text style={styles.xp}>{xp}</Text>}
        {bonus !== null ? (
          <Animated.View
            entering={FadeInUp.delay(RECAP_BONUS_MS).duration(320)}
            style={styles.line}
          >
            <Icon name="sachet" size={26} color={ink.rubric} />
            <Text style={[styles.lineText, styles.won]}>{bonus}</Text>
          </Animated.View>
        ) : (
          tally !== null && !tally.awarded && <Text style={styles.lost}>{NOT_THIS_TIME}</Text>
        )}
        {climbed.length > 0 && (
          <View style={styles.cards} accessibilityLabel="Les mots qui montent">
            {climbed.map(({ cardId, level }) => (
              <View key={cardId} style={styles.climbed}>
                <Thumb catalog={catalog} cardId={cardId} among={climbedIds} width={92} />
                <Text style={styles.up}>
                  {levelUpLine(cardOrPlaceholder(catalog, cardId, "common").word, level)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {backLine !== null && (
          <>
            <Text style={styles.comingBack}>{backLine}</Text>
            <View style={styles.cards} accessibilityLabel="Les mots à revoir demain">
              {back.map((cardId) => (
                <Thumb key={cardId} catalog={catalog} cardId={cardId} among={back} width={72} />
              ))}
            </View>
          </>
        )}
        {clanShare !== null && (
          <View style={styles.line}>
            <Icon name="clan" size={18} color={ink.pageInk} />
            <Text style={styles.lineText}>{clanShare}</Text>
          </View>
        )}
        <View style={styles.actions}>
          {actions.moreFirst ? (
            <>
              {more(true)}
              {open(false)}
            </>
          ) : (
            <>
              {open(true)}
              {more(false)}
            </>
          )}
          <TextButton label="Retour aux défis" onPress={onBack} />
        </View>
      </Panel>
    </ScrollView>
  );
}

/** Everything here is read on paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  page: {
    padding: space.s8,
    paddingBottom: TAB_BAR_RISE + 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  recap: { alignItems: "center", gap: space.s6, paddingVertical: space.s14 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    color: ink.pageInk,
    textAlign: "center",
  },
  xp: { fontFamily: fonts.display, fontSize: fontSizes.titleLarge, color: ink.rubric },
  line: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  lineText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  won: { color: ink.rubric },
  lost: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s6 },
  climbed: { width: 120, alignItems: "center", gap: space.s3 },
  up: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: ink.success,
    textAlign: "center",
  },
  comingBack: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  actions: { alignSelf: "stretch", gap: space.s5, marginTop: space.s4 },
});

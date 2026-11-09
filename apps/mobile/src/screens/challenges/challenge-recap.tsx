import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import { lettering, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  type AnsweredQuestion,
  clanAnswers,
  clanShareLine,
  climbedWords,
  comingBackTomorrow,
  masteryLevelName,
  NOT_THIS_TIME,
  PACK_NOUNS,
  RECAP_BONUS_MS,
  RECAP_CLIMBED,
  RECAP_COMING_BACK,
  RECAP_TITLE,
  recapActions,
  recapTimes,
  type SeriesQuestion,
  scoredAnswers,
  sessionBonusGain,
  sessionScore,
  sessionXpLine,
  streakTag,
} from "@leximon/view-model";
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
import { alpha, colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { GainBanner } from "@/ui/gain-banner";
import { Icon } from "@/ui/icon";
import { Fleurons, ORNAMENT_PADDING } from "@/ui/ornaments";
import { Panel } from "@/ui/panel";
import { ToyIcon } from "@/ui/toy";

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
 * The end of a series: the score, its gains as tags and a banner, the words that climbed with
 * the level they reached, those coming back tomorrow, then what to do next. Each part rises in
 * after the one above, all within about a second.
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
  const bonus = sessionBonusGain(answers, NOUN);
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
  const streak = summary === null ? null : streakTag(summary.streak);
  const actions = recapActions(summary, summary?.settings.length ?? answers.length);
  const times = recapTimes(bonus === null ? null : RECAP_BONUS_MS, climbed.length, back.length);
  // Reanimated leaves it out when the system asks for less motion.
  const rise = (ms: number) => FadeInUp.delay(ms).duration(320);
  const more = (primary: boolean) => (
    <Button label={actions.more} secondary={!primary} disabled={busy} onPress={onMore} />
  );
  const leave = (primary: boolean) => (
    <Button label={actions.back} secondary={!primary} onPress={onBack} />
  );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Panel paper style={styles.recap}>
        <Fleurons small />
        <Text style={styles.kicker}>{RECAP_TITLE.toUpperCase()}</Text>
        <Text style={styles.score} accessibilityLabel={sessionScore(scored)}>
          {right}/{scored.length}
        </Text>
        {(xp !== null || streak !== null || clanShare !== null) && (
          <Animated.View entering={rise(times.tags)} style={styles.tags}>
            {xp !== null && (
              <View style={[styles.tag, styles.xpTag]}>
                <Text style={styles.xpText}>{xp}</Text>
              </View>
            )}
            {clanShare !== null && (
              <View style={[styles.tag, styles.clanShare]}>
                <Icon name="clan" size={16} color={colors.successEdge} />
                <Text style={styles.clanShareText}>{clanShare}</Text>
              </View>
            )}
            {streak !== null && (
              <View style={styles.tag}>
                <Icon name="flag" size={15} color={ink.pageInkMuted} />
                <Text style={styles.tagText}>{streak}</Text>
              </View>
            )}
          </Animated.View>
        )}
        {bonus !== null ? (
          <Animated.View entering={rise(RECAP_BONUS_MS)} style={styles.gain}>
            <GainBanner icon="sachet" title={bonus.title} note={bonus.note} />
          </Animated.View>
        ) : (
          tally !== null &&
          !tally.awarded && (
            <Animated.Text entering={rise(times.tags)} style={styles.lost}>
              {NOT_THIS_TIME}
            </Animated.Text>
          )
        )}
        {climbed.length > 0 && (
          <View style={styles.shelf} accessibilityLabel={RECAP_CLIMBED}>
            <Animated.View entering={rise(times.climbedAt)} style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>{RECAP_CLIMBED}</Text>
              <Text style={styles.shelfCount}>{climbed.length}</Text>
            </Animated.View>
            <View style={styles.cards}>
              {climbed.map(({ cardId, level }, index) => (
                <Animated.View
                  key={cardId}
                  entering={rise(times.climbedCards[index] ?? 0)}
                  style={styles.climbed}
                >
                  <Thumb catalog={catalog} cardId={cardId} among={climbedIds} width={92} />
                  <View style={[styles.levelTag, level === "gilded" && styles.levelGilded]}>
                    <ToyIcon name={level} size={20} />
                    <Text style={styles.levelText}>{masteryLevelName(level)}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
        )}
        {back.length > 0 && (
          <View style={styles.shelf} accessibilityLabel={RECAP_COMING_BACK}>
            <Animated.View entering={rise(times.backAt)} style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>{RECAP_COMING_BACK}</Text>
              <Text style={styles.shelfCount}>{back.length}</Text>
            </Animated.View>
            <View style={styles.cards}>
              {back.map((cardId, index) => (
                <Animated.View key={cardId} entering={rise(times.backCards[index] ?? 0)}>
                  <Thumb catalog={catalog} cardId={cardId} among={back} width={72} />
                </Animated.View>
              ))}
            </View>
          </View>
        )}
        <Animated.View entering={rise(times.actions)} style={styles.actions}>
          {actions.moreFirst ? (
            <>
              {more(true)}
              {leave(false)}
            </>
          ) : (
            <>
              {leave(true)}
              {more(false)}
            </>
          )}
        </Animated.View>
      </Panel>
    </ScrollView>
  );
}

/** Everything here is read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  page: {
    padding: space.s4,
    paddingBottom: TAB_BAR_RISE + 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  recap: {
    alignItems: "center",
    gap: space.s10,
    paddingVertical: ORNAMENT_PADDING.fleurons + space.s2,
    // Three climbed cards still fit in a row, clear of the fleurons' rule.
    paddingHorizontal: space.s10,
  },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: ink.pageInkMuted,
    marginBottom: -space.s8,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 70,
    color: ink.pageInk,
    textAlign: "center",
    marginBottom: -space.s4,
  },
  // The XP, the clan's share and the days played: tags in a row, no sentence.
  tags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s4 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingVertical: space.s2,
    paddingHorizontal: space.s6,
    borderWidth: 2,
    borderColor: alpha(toyValues.outline, 0.35),
    borderRadius: 999,
    backgroundColor: alpha(toyMatters.paper.bottom, 0.55),
  },
  tagText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInkMuted },
  xpTag: { borderColor: ink.rubric, backgroundColor: alpha(ink.rubric, 0.1) },
  xpText: { fontFamily: fonts.display, fontSize: fontSizes.subtitle, color: ink.rubric },
  // What the session gave the clan: a green tag, as on the web.
  clanShare: { borderColor: colors.successDeep, backgroundColor: colors.successPale },
  clanShareText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: colors.successEdge,
  },
  gain: { alignSelf: "stretch", marginBottom: space.s4 },
  lost: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  shelf: { alignSelf: "stretch", alignItems: "center", gap: space.s6 },
  shelfHead: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  shelfTitle: { fontFamily: fonts.display, fontSize: fontSizes.subtitle, color: ink.pageInk },
  shelfCount: {
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: toyValues.outline,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    lineHeight: 24,
    color: lettering.fill,
    textAlign: "center",
  },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  climbed: { alignItems: "center", gap: space.s4 },
  // The level the word reached, drawn and named, under its card.
  levelTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 1,
    paddingLeft: 2,
    paddingRight: 8,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 999,
    backgroundColor: toyMatters.paper.top,
    boxShadow: `0 2px 0 ${toyValues.outline}`,
  },
  levelGilded: { backgroundColor: toyMatters.gold.top },
  levelText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: toyValues.outline,
  },
  actions: { alignSelf: "stretch", gap: space.s5, marginTop: space.s2 },
});

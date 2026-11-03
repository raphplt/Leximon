import type { MasteryLevelCode, PracticeScope } from "@leximon/contract";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import { createSeededRandom } from "@leximon/core";
import { type IconName, masteryColors } from "@leximon/tokens";
import {
  AFTER_ANSWER_MS,
  answerFeedback,
  challengeOutlook,
  dailyView,
  escapingWords,
  freeAnswerOutcome,
  levelShares,
  memoryCounts,
  memoryNote,
  noChallengeNotice,
  outlookLine,
  PACK_NOUNS,
  PRACTICE_REFUSED,
  reviewQuestion,
  type SessionQuestion,
  type WordMemory,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { play, vibrate } from "@/feedback/feedback";
import { dailyChallenge, ownedCards, refreshIfRead, wordMemory } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { publishProgress, wallet } from "@/player/state";
import { RiddleEntry } from "@/screens/riddle/riddle-entry";
import { openCard } from "@/screens/trades/card-row";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { ParticleStage } from "@/ui/stage";
import { Lettering } from "@/ui/toy";
import { ChallengeRecap } from "./challenge-recap";
import { takeAlbumPractice } from "./pending-practice";
import { PracticeSection } from "./practice-section";
import { QuestionView } from "./question-view";
import { advance, type Session, startSession } from "./session";

const NOUN = PACK_NOUNS.sachet;

function reviewSession(
  cardId: string,
  catalog: Catalog,
  memory: ReadonlyMap<string, WordMemory>,
): Session | null {
  const question = reviewQuestion(
    // A UUID without its dashes: the 32 hexadecimal digits a seed takes.
    createSeededRandom(randomUUID().replaceAll("-", "")),
    cardId,
    catalog.collections,
    memory.get(cardId),
    Date.now(),
  );
  return question === null ? null : startSession([question]);
}

/**
 * Défis: the daily goal, the player's memory, the words slipping away, and the sessions of
 * questions: multiple choice to keep words in memory, the word to type to raise its level.
 */
export function ChallengeScreen(props: {
  readonly word: string | null;
  readonly fromAlbum: boolean;
}) {
  return IS_LIBRARY ? (
    <ParticleStage>
      <ChallengeFlow {...props} />
    </ParticleStage>
  ) : (
    <ChallengeFlow {...props} />
  );
}

function ChallengeFlow({
  word,
  fromAlbum,
}: {
  readonly word: string | null;
  readonly fromAlbum: boolean;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never counts an answer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const now = useNow(60_000);
  const memory = useShared(wordMemory);

  const loadIt = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError("Les cartes n'ont pas pu être chargées. Réessaie."));
  }, []);
  useEffect(loadIt, [loadIt]);

  const practise = useCallback(async (scope: PracticeScope) => {
    setStarting(true);
    setNotice(null);
    setError(null);
    try {
      const series = await api.startPractice(scope);
      if (series.kind === "refused" || series.questions.length === 0) setNotice(PRACTICE_REFUSED);
      else setSession(startSession(series.questions, true));
    } catch {
      setError("Le serveur ne répond pas. Réessaie.");
    } finally {
      setStarting(false);
    }
  }, []);

  // A filter of the album, reviewed from there.
  useEffect(() => {
    if (!fromAlbum || catalog === null) return;
    router.setParams({ revision: undefined });
    const cardIds = takeAlbumPractice();
    if (cardIds !== null) void practise({ kind: "cards", cardIds: [...cardIds] });
  }, [fromAlbum, catalog, practise]);

  const start = async () => {
    setStarting(true);
    setNotice(null);
    setError(null);
    try {
      const next = await api.fetchChallenges();
      if (next.questions.length === 0)
        setNotice(noChallengeNotice(next.nextDueAt, Date.now(), NOUN));
      else setSession(startSession(next.questions));
    } catch {
      setError("Le serveur ne répond pas. Réessaie.");
    } finally {
      setStarting(false);
    }
  };

  /** A word slipping away, picked in the list: a session of that one word. */
  const review = (cardId: string) => {
    if (catalog === null || memory === null) return;
    const one = reviewSession(cardId, catalog, memory);
    if (one !== null) {
      setNotice(null);
      setSession(one);
    }
  };

  // A word asked from elsewhere (the mail): its session, once.
  useEffect(() => {
    if (word === null || catalog === null || memory === null) return;
    router.setParams({ mot: undefined });
    const one = reviewSession(word, catalog, memory);
    if (one !== null) {
      setNotice(null);
      setSession(one);
    }
  }, [word, catalog, memory]);

  /** A word that counts goes through the review; free practice only earns its XP. */
  const sendAnswer = async (question: SessionQuestion, chosen: string, key: string) => {
    if (question.format === "typed") {
      return api.answerChallenge(
        { cardId: question.cardId, format: question.format, typed: chosen },
        key,
      );
    }
    if (question.counted !== false) {
      return api.answerChallenge(
        { cardId: question.cardId, format: question.format, chosenCardId: chosen },
        key,
      );
    }
    const free = await api.answerPractice({ cardId: question.cardId, chosenCardId: chosen }, key);
    if (free.kind === "not_owned") return { kind: "not_due" as const };
    return {
      ...free,
      ...freeAnswerOutcome(memory?.get(question.cardId)?.level ?? "sketch"),
    };
  };

  const choose = async (chosen: string) => {
    if (session === null) return;
    const question = session.questions[session.index];
    if (question === undefined) return;
    const key = pendingKey ?? randomUUID();
    setPendingKey(key);
    setError(null);
    setSession({ ...session, step: { name: "sending", chosen } });
    try {
      const result = await sendAnswer(question, chosen, key);
      setPendingKey(null);
      refreshIfRead(wordMemory);
      dailyChallenge.refresh();
      if (result.kind === "not_due") {
        setSession(advance({ ...session, step: { name: "asking" } }));
        return;
      }
      publishProgress(result.progress);
      const feel = answerFeedback(result);
      play(feel.cue);
      vibrate(feel.vibration);
      const { followUp } = feel;
      if (followUp !== null) setTimeout(() => play(followUp), AFTER_ANSWER_MS);
      // A bonus sachet went to the reserve: the top bar's count follows.
      if (result.bonus.credited > 0) refreshIfRead(wallet);
      setSession({
        ...session,
        answers: [
          ...session.answers,
          {
            cardId: question.cardId,
            correct: result.correct,
            levelUp: result.levelUp,
            level: result.level,
            bonus: result.bonus,
            progress: result.progress,
            free: question.counted === false,
          },
        ],
        step: { name: "answered", chosen, slip: result.slip },
      });
    } catch {
      setError("Ta réponse n'est pas partie. Vérifie ta connexion.");
      setSession({ ...session, step: { name: "asking" } });
    }
  };

  const quit = () => {
    setSession(null);
    setError(null);
  };

  if (session !== null && catalog !== null) {
    return session.step.name === "recap" ? (
      <ChallengeRecap
        catalog={catalog}
        answers={session.answers}
        practice={session.practice}
        onBack={quit}
      />
    ) : (
      <QuestionView
        catalog={catalog}
        session={session}
        error={error}
        onChoose={(chosen) => void choose(chosen)}
        onNext={() => setSession(advance(session))}
        onQuit={quit}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {IS_LIBRARY ? (
        <View accessibilityRole="header">
          <Lettering size={fontSizes.heading}>Défis</Lettering>
        </View>
      ) : (
        <Text style={styles.title} accessibilityRole="header">
          Défis
        </Text>
      )}
      <DailyCard starting={starting} now={now} onStart={() => void start()} />
      {notice !== null && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      {error !== null && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <MemoryPanel now={now} />
      <RiddleEntry now={now} />
      {catalog !== null && <Escaping catalog={catalog} now={now} onReview={review} />}
      {catalog !== null && (
        <PracticeSection
          catalog={catalog}
          now={now}
          busy={starting}
          onPick={(scope) => void practise(scope)}
        />
      )}
    </ScrollView>
  );
}

function DailyCard({
  starting,
  now,
  onStart,
}: {
  readonly starting: boolean;
  readonly now: number;
  readonly onStart: () => void;
}) {
  const tally = useShared(dailyChallenge);
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const view = tally === null ? null : dailyView(tally, NOUN);
  const outlook =
    owned === null || memory === null
      ? null
      : outlookLine(challengeOutlook(memory, owned.keys(), now));
  return (
    <Panel paper style={styles.daily}>
      <View style={styles.dailyHead}>
        <View style={styles.dailyTexts}>
          <Text style={styles.kicker}>DÉFI DU JOUR</Text>
          <Text style={styles.dailyTitle}>{view?.title ?? " "}</Text>
          <Text style={styles.dailyText}>{view?.text ?? " "}</Text>
        </View>
        <View style={styles.dailyIcon}>
          <Icon name="sachet" size={30} color={ink.rubric} />
        </View>
      </View>
      <View style={styles.bars} importantForAccessibility="no-hide-descendants">
        {(view?.bars ?? ["empty", "empty", "empty", "empty", "empty"]).map((bar, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions of the goal
          <View key={index} style={[styles.bar, styles[bar]]} />
        ))}
      </View>
      {outlook !== null && <Text style={styles.dailyText}>{outlook}</Text>}
      {view?.done ? (
        <Button label="Réviser encore" secondary disabled={starting} onPress={onStart} />
      ) : (
        <Button
          label={view?.action ?? "Commencer le défi"}
          disabled={starting || view === null}
          onPress={onStart}
        />
      )}
    </Panel>
  );
}

const LEVELS: readonly { level: MasteryLevelCode; label: string; icon: IconName }[] = [
  { level: "sketch", label: "Esquisse", icon: "plume" },
  { level: "ink", label: "Encre", icon: "encre" },
  { level: "gilded", label: "Dorure", icon: "star" },
];

function MemoryPanel({ now }: { readonly now: number }) {
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const levels = new Map(
    [...(memory ?? new Map()).entries()].map(([id, word]) => [id, word.level]),
  );
  const counts = memoryCounts(owned?.keys() ?? [], levels);
  const shares = levelShares(counts);
  return (
    <Panel paper>
      <Text style={styles.kicker}>TA MÉMOIRE</Text>
      <View style={styles.levels}>
        {LEVELS.map(({ level, label, icon }) => (
          <View key={level} style={styles.level}>
            <Icon name={icon} size={20} color={masteryColors[level]} />
            <Text style={styles.levelCount}>{owned === null ? "–" : counts[level]}</Text>
            <Text style={styles.levelLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {owned !== null && owned.size > 0 && (
        <View style={styles.shares} importantForAccessibility="no-hide-descendants">
          {LEVELS.map(({ level }) => (
            <View
              key={level}
              style={{
                flexGrow: shares[level],
                backgroundColor: level === "sketch" ? ink.track : masteryColors[level],
              }}
            />
          ))}
        </View>
      )}
      <Text style={styles.note}>{memoryNote(now)}</Text>
    </Panel>
  );
}

/** Words slipping away: due now, or within the day. */
function Escaping({
  catalog,
  now,
  onReview,
}: {
  readonly catalog: Catalog;
  readonly now: number;
  readonly onReview: (cardId: string) => void;
}) {
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  if (owned === null || memory === null) return null;
  const words = escapingWords(memory, new Set(owned.keys()), now);
  if (words.length === 0) return null;
  return (
    <View style={styles.escaping}>
      <Text style={styles.subtitle} accessibilityRole="header">
        Mots à réviser
      </Text>
      {words.map((entry) => {
        const card = cardOrPlaceholder(catalog, entry.cardId, "common");
        return (
          <Panel key={entry.cardId} paper style={styles.slipping}>
            <Pressable
              onPress={() =>
                openCard(
                  card.id,
                  words.map((word) => word.cardId),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Voir la carte ${card.word}`}
            >
              <View importantForAccessibility="no-hide-descendants">
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={56}
                />
              </View>
            </Pressable>
            <View style={styles.slippingText}>
              <Text style={styles.slippingWord}>{card.word}</Text>
              <Text style={styles.slippingWhen}>{entry.when}</Text>
              {entry.rise !== null && <Text style={styles.slippingRise}>{entry.rise}</Text>}
            </View>
            {entry.due && (
              <Pressable
                onPress={() => onReview(card.id)}
                accessibilityRole="button"
                style={styles.reviewButton}
              >
                <Text style={styles.reviewText}>Réviser</Text>
              </Pressable>
            )}
          </Panel>
        );
      })}
    </View>
  );
}

/** Everything here is read on paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  page: {
    gap: space.s8,
    paddingHorizontal: space.s8,
    paddingTop: space.s4,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  title: { fontFamily: fonts.display, fontSize: fontSizes.heading, color: colors.pageInk },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  daily: { gap: space.s8 },
  dailyHead: { flexDirection: "row", gap: space.s6 },
  dailyTexts: { flex: 1, gap: space.s3 },
  dailyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 30,
    color: ink.pageInk,
  },
  dailyText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  dailyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(ink.gilt, 0.14),
  },
  bars: { flexDirection: "row", gap: space.s3 },
  bar: { flex: 1, height: 8, borderRadius: 4 },
  right: { backgroundColor: ink.success },
  wrong: { backgroundColor: ink.danger },
  empty: { backgroundColor: ink.well },
  notice: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInk,
  },
  error: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.danger,
  },
  levels: { flexDirection: "row", justifyContent: "space-between" },
  level: { flex: 1, alignItems: "center", gap: space.s2 },
  levelCount: { fontFamily: fonts.display, fontSize: fontSizes.titleLarge, color: ink.pageInk },
  levelLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInkMuted },
  shares: { flexDirection: "row", gap: 3, height: 8, borderRadius: 4, overflow: "hidden" },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  escaping: { gap: space.s5 },
  subtitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.pageInk,
    marginTop: space.s2,
  },
  slipping: { flexDirection: "row", alignItems: "center", gap: space.s7, padding: space.s6 },
  slippingText: { flex: 1, gap: space.s1 },
  slippingWord: { fontFamily: fonts.display, fontSize: fontSizes.subtitle, color: ink.pageInk },
  slippingWhen: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  slippingRise: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.rubric },
  reviewButton: {
    minHeight: 38,
    paddingHorizontal: space.s7,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: ink.track,
    justifyContent: "center",
  },
  reviewText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
});

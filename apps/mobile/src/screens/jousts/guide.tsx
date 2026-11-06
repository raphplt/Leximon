import type { CatalogCard, JoustDeckResponse } from "@leximon/contract";
import { type IconName, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  COMPOSE_DECK,
  FURET,
  FURET_RUN,
  GUIDE_DECK_SAVED,
  GUIDE_LATER,
  GUIDE_NO_DECK,
  GUIDE_SKIP,
  GUIDE_STEPS,
  GUIDE_UNDERSTOOD,
  type GuideStep,
  guideLine,
  guideRules,
  LAUNCH_RANKED,
  type RunSize,
  TRAINING_CONTINUE,
  TRAINING_KICKER,
  type TrainingQuestion,
  trainingClosing,
  trainingOutcome,
  trainingQuestions,
} from "@leximon/view-model";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useCatalog } from "@/cards/use-catalog";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { Leaf, Lettering, ToyBody } from "@/ui/toy";
import { DeckBuilder } from "./deck-builder";
import { type Duelist, DuelistFace, Furet, ink, MiniCard, Notice, pieces } from "./pieces";
import { Reveal, type RevealAnswer } from "./reveal";
import { RunScene, type RunSource } from "./run-scene";

const FURET_DUELIST: Duelist = { name: FURET, avatar: null, frame: null, furet: true };
const RULE_ICONS: readonly IconName[] = ["clock", "check", "bolt"];

/**
 * The first visit to the jousts, with Maître Furet: the lists, the player's deck, a training run
 * against him, then the first joust. Each step can be passed; closing it marks it done.
 */
export function Guide({
  deck,
  deckSaved,
  jousted,
  size,
  me,
  busy,
  refusal,
  onDeckSaved,
  onLaunch,
  onClose,
}: {
  readonly deck: JoustDeckResponse;
  readonly deckSaved: boolean;
  /** The player jousted before composing a deck: the deck they played starts in place. */
  readonly jousted: boolean;
  readonly size: RunSize;
  readonly me: Duelist;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onDeckSaved: () => void;
  readonly onLaunch: () => void;
  readonly onClose: () => void;
}) {
  const [step, setStep] = useState<GuideStep>(0);
  const next = () => (step === 3 ? onClose() : setStep((step + 1) as GuideStep));
  return (
    <View style={styles.guide}>
      <View style={styles.head}>
        <View style={styles.steps}>
          {GUIDE_STEPS.map((label, index) => {
            const on = index === step;
            const done = index < step;
            return (
              <Pressable
                key={label}
                onPress={() => setStep(index as GuideStep)}
                hitSlop={4}
                style={styles.step}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${index + 1}. ${label}`}
              >
                <ToyBody
                  matter={on ? "gold" : done ? "green" : "paper"}
                  shape="round"
                  style={styles.stepChip}
                >
                  {done ? (
                    <Icon name="check" size={14} color={toyMatters.paper.top} />
                  ) : (
                    <Lettering size={fontSizes.small}>{index + 1}</Lettering>
                  )}
                </ToyBody>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={next} hitSlop={8} accessibilityRole="button">
          <Text style={styles.skip}>{GUIDE_SKIP}</Text>
        </Pressable>
      </View>
      <View accessibilityRole="header">
        <Lettering size={fontSizes.title}>{GUIDE_STEPS[step]}</Lettering>
      </View>

      {step === 0 && (
        <Leaf style={pieces.leaf}>
          <GuideLists deck={deck} size={size} me={me} onNext={next} />
        </Leaf>
      )}
      {step === 1 && (
        <Leaf style={pieces.leaf}>
          <DeckBuilder
            deck={deck}
            initial={deck.saved || jousted ? deck.cardIds : []}
            intro={<Furet>{guideLine(1, size, deck)}</Furet>}
            onSaved={() => {
              onDeckSaved();
              next();
            }}
          />
        </Leaf>
      )}
      {step === 2 && <Training deck={deck} size={size} me={me} onNext={next} />}
      {step === 3 && (
        <Leaf style={pieces.leaf}>
          <Furet>
            {deckSaved ? `${guideLine(3, size, deck)}\n\n${GUIDE_DECK_SAVED}` : GUIDE_NO_DECK}
          </Furet>
          <Notice>{refusal}</Notice>
          <View style={pieces.actions}>
            {deckSaved ? (
              <MainAction label={LAUNCH_RANKED} disabled={busy} onPress={onLaunch} />
            ) : (
              <MainAction label={COMPOSE_DECK} onPress={() => setStep(1)} />
            )}
            <PaperAction label={GUIDE_LATER} onPress={onClose} />
          </View>
        </Leaf>
      )}
    </View>
  );
}

/** The lists: the player's cards cross to the other side, the other's come to theirs. */
function GuideLists({
  deck,
  size,
  me,
  onNext,
}: {
  readonly deck: JoustDeckResponse;
  readonly size: RunSize;
  readonly me: Duelist;
  readonly onNext: () => void;
}) {
  const catalog = useCatalog();
  const sides = useMemo(() => {
    if (catalog === null) return null;
    const mine = deck.cardIds.slice(0, size.questions).map((id) => catalogCard(catalog, id));
    const taken = new Set(mine.map((card) => card.id));
    const theirs = [...catalog.cardsById.values()]
      .filter((card) => !taken.has(card.id) && card.rarity !== "common")
      .slice(0, size.questions);
    return { mine, theirs };
  }, [catalog, deck.cardIds, size.questions]);
  const cards = (list: readonly CatalogCard[], toward: 1 | -1) =>
    list.map((card, index) => (
      <Crossing key={card.id} index={index} toward={toward}>
        <MiniCard card={card} width={104} />
      </Crossing>
    ));
  return (
    <>
      <Furet>{guideLine(0, size, deck)}</Furet>
      <View style={styles.lists}>
        <View style={styles.listSide}>
          <DuelistFace duelist={me} size={52} />
          <Text style={styles.listName}>Ton deck</Text>
          {sides !== null && cards(sides.mine, 1)}
        </View>
        <View style={styles.listMiddle}>
          <Lettering size={fontSizes.body}>contre</Lettering>
        </View>
        <View style={styles.listSide}>
          <ToyBody matter="red" shape="round" style={styles.unknown}>
            <Lettering size={fontSizes.heading}>?</Lettering>
          </ToyBody>
          <Text style={styles.listName}>Son deck</Text>
          {sides !== null && cards(sides.theirs, -1)}
        </View>
      </View>
      <View style={styles.rules}>
        {guideRules(size).map((rule, index) => (
          <Animated.View
            key={rule}
            entering={FadeIn.delay(300 + index * 150).duration(300)}
            style={styles.rule}
          >
            <Icon name={RULE_ICONS[index] ?? "check"} size={22} color={ink.rubric} />
            <Text style={styles.ruleText}>{rule}</Text>
          </Animated.View>
        ))}
      </View>
      <View style={pieces.actions}>
        <PaperAction label={GUIDE_UNDERSTOOD} onPress={onNext} />
      </View>
    </>
  );
}

/** A card leaning toward the other side and back, again and again: it goes to the other player. */
function Crossing({
  index,
  toward,
  children,
}: {
  readonly index: number;
  readonly toward: 1 | -1;
  readonly children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const lean = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const ease = Easing.bezier(0.5, 0, 0.3, 1);
    lean.value = withDelay(
      index * 90,
      withRepeat(
        withSequence(
          withDelay(700, withTiming(1, { duration: 1_100, easing: ease })),
          withDelay(1_100, withTiming(0, { duration: 700, easing: ease })),
        ),
        -1,
      ),
    );
  }, [index, reduced, lean]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: toward * 14 * lean.value },
      { translateY: -6 * lean.value },
      { rotate: `${toward * 6 * lean.value}deg` },
    ],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Three words against Maître Furet on the real clock, then the result as a joust reveals it. */
function Training({
  deck,
  size,
  me,
  onNext,
}: {
  readonly deck: JoustDeckResponse;
  readonly size: RunSize;
  readonly me: Duelist;
  readonly onNext: () => void;
}) {
  const catalog = useCatalog();
  // Drawn once: the deck reloaded after its save must not change the questions mid-run.
  const [questions, setQuestions] = useState<readonly TrainingQuestion[] | null>(null);
  useEffect(() => {
    if (catalog === null || questions !== null) return;
    const all = [...catalog.cardsById.values()];
    const known = deck.candidates.map((candidate) => catalogCard(catalog, candidate.cardId));
    setQuestions(trainingQuestions(known, all, size.choices, Math.random));
  }, [catalog, questions, deck.candidates, size.choices]);
  const answers = useRef(new Map<number, RevealAnswer>());
  const source = useMemo(
    () =>
      questions === null ? null : trainingSource(questions, size.seconds * 1000, answers.current),
    [questions, size.seconds],
  );
  const [over, setOver] = useState(false);
  // Once the questions come, Maître Furet steps aside so that the four words stay in view.
  const [started, setStarted] = useState(false);
  const start = useCallback(() => setStarted(true), []);

  if (questions === null || source === null) return <View style={styles.wait} />;
  if (!over) {
    return (
      <View style={styles.training}>
        {!started && <Furet>{guideLine(2, size, deck)}</Furet>}
        <RunScene
          source={source}
          me={me}
          them={FURET_DUELIST}
          ghost={FURET_RUN}
          questions={questions.length}
          answered={0}
          kicker={TRAINING_KICKER}
          doneLabel={TRAINING_CONTINUE}
          onDone={() => setOver(true)}
          onStart={start}
        />
      </View>
    );
  }
  const mine = questions.map(
    (question, position) =>
      answers.current.get(position) ?? {
        cardId: question.cardId,
        correct: false,
        ms: size.seconds * 1000,
      },
  );
  const theirs = questions.map((question, position) => ({
    cardId: question.cardId,
    correct: FURET_RUN[position]?.correct ?? false,
    ms: FURET_RUN[position]?.ms ?? 0,
  }));
  const outcome = trainingOutcome(mine);
  return (
    <Reveal
      data={{
        me,
        them: FURET_DUELIST,
        mine,
        theirs,
        outcome,
        gains: null,
        closing: trainingClosing(outcome),
      }}
      kicker={TRAINING_KICKER}
      playing
    >
      <MainAction label={TRAINING_CONTINUE} onPress={onNext} />
    </Reveal>
  );
}

/** The training's questions on this device's clock, with the answers kept for its result. */
function trainingSource(
  questions: readonly TrainingQuestion[],
  answerMs: number,
  answers: Map<number, RevealAnswer>,
): RunSource {
  return {
    graceMs: 0,
    async next(after) {
      const position = after === null ? 0 : after + 1;
      const question = questions[position];
      if (question === undefined) return { kind: "over" };
      return {
        kind: "question",
        question: {
          position,
          definition: question.definition,
          choices: question.choices,
          deadline: Date.now() + answerMs,
          totalMs: answerMs,
        },
      };
    },
    async answer(served, cardId) {
      const question = questions[served.position];
      const rightCardId = question?.cardId ?? "";
      const late = Date.now() > served.deadline;
      const correct = !late && cardId === rightCardId;
      answers.set(served.position, {
        cardId: rightCardId,
        correct,
        ms: Math.min(answerMs, answerMs - (served.deadline - Date.now())),
      });
      return { correct, rightCardId, late, runOver: served.position === questions.length - 1 };
    },
  };
}

const styles = StyleSheet.create({
  guide: { gap: space.s6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  steps: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  step: { paddingBottom: 3 },
  stepChip: { width: 32, height: 32 },
  skip: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    color: toyMatters.paper.top,
    textDecorationLine: "underline",
  },
  lists: { flexDirection: "row", alignItems: "flex-start" },
  listSide: { flex: 1, alignItems: "center", gap: space.s3 },
  listMiddle: { width: 56, alignItems: "center", paddingTop: space.s12 },
  listName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  unknown: { width: 52, height: 52, borderColor: toyValues.outline },
  rules: { gap: space.s4 },
  rule: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  ruleText: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
  training: { gap: space.s6 },
  wait: { minHeight: 300 },
});

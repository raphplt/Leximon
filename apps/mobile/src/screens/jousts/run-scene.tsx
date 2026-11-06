import type { AnswerJoustResponse } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import {
  lettering,
  rarityStyles,
  revealEffects,
  solidColor,
  type ToyMatterName,
  toyMatters,
  toy as toyValues,
} from "@leximon/tokens";
import { secondsLeft } from "@leximon/view-model";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewInstance } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  Keyframe,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useCatalog } from "@/cards/use-catalog";
import { play, vibrate } from "@/feedback/feedback";
import { catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { RarityIcon } from "@/ui/rarity-icon";
import { useStage } from "@/ui/stage";
import { Leaf, Lettering, Toy } from "@/ui/toy";
import { type Duelist, DuelistFace, ink, LeafKicker, Notice, pieces } from "./pieces";

/** A question as the scene shows it, its clock set on this device. */
export interface RunQuestion {
  readonly position: number;
  readonly definition: string;
  readonly choices: readonly string[];
  readonly deadline: number;
  readonly totalMs: number;
}

export type NextResult =
  | { readonly kind: "question"; readonly question: RunQuestion }
  /** The previous question is still on at the server: ask again in a moment. */
  | { readonly kind: "wait" }
  | { readonly kind: "over" };

/** Where the questions come from: the server's clock, or the training against Maître Furet. */
export interface RunSource {
  /** The question after `after`, or the one in flight when `after` is `null`. */
  readonly next: (after: number | null) => Promise<NextResult>;
  readonly answer: (question: RunQuestion, cardId: string) => Promise<AnswerJoustResponse>;
  /** After the clock, the answer is still taken this long: the next question waits for it. */
  readonly graceMs: number;
}

/** How long the answer stays shown before the next question. */
const FEEDBACK_MS = 1_300;
const COUNTDOWN = [3, 2, 1] as const;
const COUNT_MS = 800;
const HOT_SECONDS = 5;

type Phase =
  | { readonly kind: "versus"; readonly count: number }
  | { readonly kind: "loading" }
  | { readonly kind: "question"; readonly question: RunQuestion; readonly sending: boolean }
  | {
      readonly kind: "answered";
      readonly question: RunQuestion;
      readonly chosen: string | null;
      readonly answer: AnswerJoustResponse;
    }
  | { readonly kind: "done" };

/** The answers of a lane: right, wrong, or answered before the screen came (`null`). */
type LaneAnswer = boolean | null;

/** The definition turns like a card as it comes. */
const flipIn = new Keyframe({
  0: { opacity: 0, transform: [{ perspective: 800 }, { rotateY: "90deg" }] },
  100: { opacity: 1, transform: [{ perspective: 800 }, { rotateY: "0deg" }] },
}).duration(320);

/** Each figure of the countdown lands hard, as on a drum. */
const countIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 2.4 }] },
  60: { opacity: 1, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(360);

const stampIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.9 }, { rotate: "-8deg" }] },
  55: { opacity: 1, transform: [{ scale: 0.92 }, { rotate: "-8deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "-8deg" }] },
}).duration(420);

/**
 * A run on the clock: the face-to-face and its countdown, then each definition turned like a card,
 * the ring of the clock, the four words, and the two ribbons of the players' answers.
 */
export function RunScene({
  source,
  me,
  them,
  ghost,
  questions,
  answered,
  kicker,
  doneLabel,
  onDone,
  onStart,
}: {
  readonly source: RunSource;
  readonly me: Duelist;
  readonly them: Duelist;
  /** The other player's recorded run, when they played first. */
  readonly ghost: readonly { readonly correct: boolean }[] | null;
  readonly questions: number;
  /** Questions answered before the screen came. */
  readonly answered: number;
  readonly kicker: string;
  readonly doneLabel: string;
  readonly onDone: () => void;
  /** The first question is on: what stood above the scene can make room for it. */
  readonly onStart?: () => void;
}) {
  const stage = useStage();
  const catalog = useCatalog();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ kind: "versus", count: 0 });
  const [results, setResults] = useState<readonly LaneAnswer[]>(() =>
    Array.from({ length: answered }, () => null),
  );
  const [flying, setFlying] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const retry = useRef<() => void>(() => undefined);
  const choiceViews = useRef(new Map<string, ViewInstance>());
  const shake = useSharedValue(0);
  const shaken = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const later = useCallback((ms: number, action: () => void) => {
    timers.current.push(setTimeout(action, ms));
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const shakeCard = useCallback(() => {
    if (reduced) return;
    shake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 70 }),
      withTiming(-6, { duration: 70 }),
      withTiming(6, { duration: 70 }),
      withTiming(0, { duration: 50 }),
    );
  }, [reduced, shake]);

  const fetchNext = useCallback(
    async (after: number | null) => {
      clear();
      setError(null);
      setPhase({ kind: "loading" });
      try {
        const result = await source.next(after);
        if (result.kind === "wait") {
          later(1_000, () => void fetchNext(after));
          return;
        }
        if (result.kind === "over") {
          setPhase({ kind: "done" });
          play("recap");
          return;
        }
        setNow(Date.now());
        setPhase({ kind: "question", question: result.question, sending: false });
        if (after === null) onStart?.();
        play("flip");
      } catch (failure) {
        retry.current = () => void fetchNext(after);
        setError(failure instanceof Error ? failure.message : "Le serveur ne répond pas.");
      }
    },
    [source, clear, later, onStart],
  );

  const settle = useCallback(
    (question: RunQuestion, chosen: string | null, answer: AnswerJoustResponse) => {
      setPhase({ kind: "answered", question, chosen, answer });
      setResults((done) => [...done, answer.correct]);
      later(FEEDBACK_MS, () =>
        answer.runOver ? setPhase({ kind: "done" }) : void fetchNext(question.position),
      );
    },
    [later, fetchNext],
  );

  const skipVersus = () => {
    if (phase.kind === "versus") void fetchNext(null);
  };

  // The face-to-face, then 3, 2, 1: the server's clock starts only with the first question.
  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once, when the scene appears
  useEffect(() => {
    COUNTDOWN.forEach((_, index) => {
      later(900 + index * COUNT_MS, () => {
        setPhase({ kind: "versus", count: index + 1 });
        play("cardSlide");
        vibrate([12]);
      });
    });
    later(900 + COUNTDOWN.length * COUNT_MS, () => void fetchNext(null));
  }, []);

  // The clock, a frame every tenth of a second while a question is on.
  useEffect(() => {
    if (phase.kind !== "question") return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [phase.kind]);

  const left = phase.kind === "question" ? secondsLeft(phase.question.deadline, now) : null;
  // A tick for each of the last seconds.
  useEffect(() => {
    if (left !== null && left > 0 && left <= HOT_SECONDS) play("cardSlide");
  }, [left]);

  // Out of time: the question counts wrong, the next comes once the answer can no longer be taken.
  useEffect(() => {
    if (phase.kind !== "question" || phase.sending) return;
    if (now < phase.question.deadline + source.graceMs) return;
    shakeCard();
    play("answerWrong");
    settle(phase.question, null, { correct: false, rightCardId: "", late: true, runOver: false });
  }, [now, phase, source.graceMs, settle, shakeCard]);

  const answer = async (question: RunQuestion, cardId: string) => {
    setPhase({ kind: "question", question, sending: true });
    setError(null);
    let result: AnswerJoustResponse;
    try {
      result = await source.answer(question, cardId);
    } catch (failure) {
      setPhase({ kind: "question", question, sending: false });
      setError(failure instanceof Error ? failure.message : "Le serveur ne répond pas.");
      retry.current = () => setError(null);
      return;
    }
    if (result.correct) {
      choiceViews.current.get(cardId)?.measureInWindow((x, y, width, height) => {
        const cx = x + width / 2;
        const cy = y + height / 2;
        stage.ring(cx, cy, toyMatters.green.top, 1.6);
        for (const burst of revealEffects.uncommon.bursts) {
          stage.burst(cx, cy, {
            ...burst,
            colors: [toyMatters.gold.top, toyMatters.green.top, toyMatters.paper.top],
          });
        }
      });
      setFlying((count) => count + 1);
      play("answerRight");
      vibrate([18]);
    } else {
      shakeCard();
      play("answerWrong");
      vibrate([40, 30, 40]);
    }
    settle(question, cardId, result);
  };

  const wordOf = (cardId: string) => (catalog === null ? "…" : catalogCard(catalog, cardId).word);
  const rarityOf = (choices: readonly string[]): Rarity | null => {
    if (catalog === null) return null;
    const rarities = new Set(choices.map((id) => catalogCard(catalog, id).rarity));
    return rarities.size === 1 ? ([...rarities][0] ?? null) : null;
  };
  const shown = phase.kind === "question" || phase.kind === "answered" ? phase : null;
  const ghostSoFar =
    ghost === null
      ? []
      : ghost.slice(0, phase.kind === "done" ? ghost.length : results.length).map((g) => g.correct);

  return (
    <Leaf style={pieces.leaf}>
      <LeafKicker>{kicker}</LeafKicker>
      <Lanes me={me.name} them={them.name} mine={results} theirs={ghostSoFar} total={questions} />

      {phase.kind === "versus" && (
        // A touch skips the face-to-face.
        <Pressable
          style={styles.versus}
          onPress={skipVersus}
          accessibilityRole="button"
          accessibilityLabel={`${me.name} contre ${them.name}. Touche pour commencer.`}
        >
          <Animated.View entering={FadeInLeft.duration(420)} style={styles.versusSide}>
            <DuelistFace duelist={me} size={84} />
            <Lettering size={fontSizes.bodyLarge} numberOfLines={2} style={styles.centered}>
              {me.name}
            </Lettering>
          </Animated.View>
          <View style={styles.versusMiddle}>
            {phase.count === 0 ? (
              <Animated.View entering={FadeIn.delay(300).duration(300)}>
                <Lettering size={fontSizes.title}>contre</Lettering>
              </Animated.View>
            ) : (
              <Animated.View key={phase.count} entering={countIn}>
                <Lettering size={fontSizes.displayLarge + 12}>
                  {COUNTDOWN[phase.count - 1] ?? ""}
                </Lettering>
              </Animated.View>
            )}
          </View>
          <Animated.View entering={FadeInRight.duration(420)} style={styles.versusSide}>
            <DuelistFace duelist={them} size={84} />
            <Lettering size={fontSizes.bodyLarge} numberOfLines={2} style={styles.centered}>
              {them.name}
            </Lettering>
          </Animated.View>
        </Pressable>
      )}

      {phase.kind === "loading" && <View style={styles.wait} accessibilityState={{ busy: true }} />}

      {shown !== null && (
        <View style={styles.question}>
          <View style={styles.questionTop}>
            <Text style={styles.counter}>
              {shown.question.position + 1} / {questions}
            </Text>
            <Ring
              key={shown.question.position}
              question={shown.question}
              running={shown.kind === "question"}
              left={left ?? 0}
            />
          </View>
          <Animated.View style={shaken}>
            <Animated.View key={`card-${shown.question.position}`} entering={flipIn}>
              <Definition
                rarity={rarityOf(shown.question.choices)}
                text={shown.question.definition}
              />
            </Animated.View>
          </Animated.View>
          <View style={styles.choices}>
            {shown.question.choices.map((cardId) => {
              const answeredNow = shown.kind === "answered" ? shown : null;
              const isRight = answeredNow !== null && cardId === answeredNow.answer.rightCardId;
              const chosen = answeredNow !== null && answeredNow.chosen === cardId;
              const matter: ToyMatterName = isRight ? "green" : chosen ? "red" : "paper";
              const word = wordOf(cardId);
              return (
                <View
                  key={cardId}
                  collapsable={false}
                  ref={(node) => {
                    if (node === null) choiceViews.current.delete(cardId);
                    else choiceViews.current.set(cardId, node);
                  }}
                  style={[
                    styles.choiceCell,
                    answeredNow !== null && !isRight && !chosen && styles.dim,
                  ]}
                >
                  <Reaction kind={isRight ? "right" : chosen ? "wrong" : "idle"}>
                    <Toy
                      matter={matter}
                      style={styles.choice}
                      bodyStyle={styles.choiceBody}
                      accessibilityRole="button"
                      accessibilityLabel={word}
                      disabled={shown.kind !== "question" || shown.sending}
                      onPress={() => {
                        if (shown.kind === "question" && !shown.sending) {
                          void answer(shown.question, cardId);
                        }
                      }}
                    >
                      {isRight || chosen ? (
                        <Lettering size={fontSizes.body} numberOfLines={2} style={styles.centered}>
                          {word}
                        </Lettering>
                      ) : (
                        <Text
                          style={[styles.choiceWord, { fontSize: choiceSize(word) }]}
                          numberOfLines={2}
                          android_hyphenationFrequency="full"
                        >
                          {word}
                        </Text>
                      )}
                    </Toy>
                  </Reaction>
                </View>
              );
            })}
          </View>
          {shown.kind === "answered" && shown.answer.late && (
            <Text style={styles.late} accessibilityLiveRegion="polite">
              Le temps est écoulé : la question compte fausse.
            </Text>
          )}
          {flying > 0 && <PlusOne key={flying} />}
        </View>
      )}

      {phase.kind === "done" && (
        <View style={styles.done}>
          <Animated.View entering={stampIn} style={styles.stamp}>
            <Text style={styles.stampText}>PARTIE JOUÉE</Text>
          </Animated.View>
          <Toy
            matter="gold"
            style={styles.control}
            accessibilityRole="button"
            accessibilityLabel={doneLabel}
            onPress={onDone}
          >
            <Lettering size={fontSizes.lead}>{doneLabel}</Lettering>
          </Toy>
        </View>
      )}

      {error !== null && (
        <View style={styles.error}>
          <Notice>{error}</Notice>
          <Toy
            matter="paper"
            style={styles.control}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
            onPress={() => retry.current()}
          >
            <Lettering size={fontSizes.body}>Réessayer</Lettering>
          </Toy>
        </View>
      )}
    </Leaf>
  );
}

function Definition({ rarity, text }: { readonly rarity: Rarity | null; readonly text: string }) {
  const band = rarity === null ? toyMatters.dark.bottom : solidColor(rarityStyles[rarity].band);
  return (
    <View style={styles.definition}>
      <View style={[styles.definitionBand, { backgroundColor: band }]}>
        {rarity !== null && (
          <RarityIcon rarity={rarity} size={13} color={rarityStyles[rarity].bandInk} />
        )}
      </View>
      <Text style={styles.definitionText} accessibilityRole="header">
        {text}
      </Text>
    </View>
  );
}

/** A long word takes a smaller size, so that it holds on its half of the row. */
function choiceSize(word: string): number {
  const longest = Math.max(...word.split(" ").map((piece) => piece.length));
  if (longest > 15) return fontSizes.small;
  if (longest > 12) return fontSizes.body;
  return fontSizes.bodyLarge;
}

/** A right word swells for a moment, a wrong one shakes once; nothing with reduced motion. */
function Reaction({
  kind,
  children,
}: {
  readonly kind: "idle" | "right" | "wrong";
  readonly children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    if (kind === "right") {
      scale.value = withSequence(
        withTiming(1.05, { duration: 130 }),
        withTiming(1, { duration: 160 }),
      );
    } else if (kind === "wrong") {
      shift.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 70 }),
        withTiming(-6, { duration: 70 }),
        withTiming(6, { duration: 70 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [kind, reduced, scale, shift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shift.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The point won flies up from the words. */
function PlusOne() {
  const reduced = useReducedMotion();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [rise]);
  const style = useAnimatedStyle(() => ({
    opacity: rise.value < 0.7 ? 1 : 1 - (rise.value - 0.7) / 0.3,
    transform: [{ translateY: -70 * rise.value }, { scale: 1 + rise.value * 0.3 }],
  }));
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.plusOne, style]}>
      <Lettering size={fontSizes.heading} color={toyMatters.green.top}>
        +1
      </Lettering>
    </Animated.View>
  );
}

/** Two ribbons: the player's answers and the other's recorded ones, question by question. */
function Lanes({
  me,
  them,
  mine,
  theirs,
  total,
}: {
  readonly me: string;
  readonly them: string;
  readonly mine: readonly LaneAnswer[];
  readonly theirs: readonly LaneAnswer[];
  readonly total: number;
}) {
  const lane = (name: string, answers: readonly LaneAnswer[]) => (
    <View style={styles.lane}>
      <Text style={styles.laneName} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.pips}>
        {Array.from({ length: total }, (_, index) => {
          const answer = answers[index];
          const fill =
            answer === undefined
              ? ink.track
              : answer === null
                ? toyMatters.dark.bottom
                : answer
                  ? toyMatters.green.top
                  : toyMatters.red.top;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: one pip per question, in order
            <View key={index} style={[styles.pip, { backgroundColor: fill }]}>
              {typeof answer === "boolean" && (
                <Animated.View entering={countIn}>
                  <Icon name={answer ? "check" : "close"} size={12} color={toyMatters.paper.top} />
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>
      <Lettering size={fontSizes.subtitle}>{answers.filter((a) => a === true).length}</Lettering>
    </View>
  );
  return (
    <View style={styles.lanes}>
      {lane(me, mine)}
      {lane(them, theirs)}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_SIZE = 58;
const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The clock: a ring that empties over the question's time and turns red for the last seconds. */
function Ring({
  question,
  running,
  left,
}: {
  readonly question: RunQuestion;
  readonly running: boolean;
  readonly left: number;
}) {
  const spent = useSharedValue(
    Math.min(1, Math.max(0, 1 - (question.deadline - Date.now()) / question.totalMs)),
  );
  // The clock is information, not decoration: it runs even for a player who asks for less motion.
  useEffect(() => {
    if (!running) {
      cancelAnimation(spent);
      return;
    }
    const remaining = Math.max(0, question.deadline - Date.now());
    spent.value = withTiming(1, {
      duration: remaining,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
  }, [running, question.deadline, spent]);
  const drained = useAnimatedProps(() => ({ strokeDashoffset: spent.value * RING_LENGTH }));
  // Once answered, the figure stays where the clock stopped.
  const figure = useRef(left);
  if (running) figure.current = left;
  const hot = figure.current <= HOT_SECONDS;
  const center = RING_SIZE / 2;
  return (
    <View style={styles.ring} accessibilityLabel={`${figure.current} secondes`}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={RING_RADIUS}
          stroke={ink.track}
          strokeWidth={6}
          fill={toyMatters.paper.top}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={RING_RADIUS}
          stroke={hot ? toyMatters.red.bottom : toyMatters.green.top}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
          animatedProps={drained}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Lettering size={fontSizes.title} color={hot ? toyMatters.red.top : lettering.fill}>
        {figure.current}
      </Lettering>
    </View>
  );
}

const styles = StyleSheet.create({
  lanes: { gap: space.s3 },
  lane: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  laneName: {
    width: 96,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.pageInk,
  },
  pips: { flex: 1, flexDirection: "row", gap: space.s2 },
  pip: {
    flex: 1,
    maxWidth: 30,
    height: 18,
    borderRadius: radii.xs,
    borderWidth: 2,
    borderColor: toyValues.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  versus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 220,
  },
  versusSide: { flex: 1, alignItems: "center", gap: space.s4 },
  versusMiddle: { width: 86, alignItems: "center", justifyContent: "center" },
  wait: { minHeight: 300 },
  question: { gap: space.s6 },
  questionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counter: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  definition: {
    minHeight: 96,
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.paper.top,
    boxShadow: `0 4px 0 ${toyValues.outline}`,
  },
  definitionBand: { height: 20, alignItems: "center", justifyContent: "center" },
  definitionText: {
    paddingHorizontal: space.s8,
    paddingVertical: space.s6,
    textAlign: "center",
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInk,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: space.s3,
  },
  choiceCell: { width: "48.5%" },
  choice: { height: 60 },
  choiceBody: { paddingHorizontal: space.s4, paddingVertical: space.s3 },
  choiceWord: {
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
  centered: { textAlign: "center" },
  dim: { opacity: 0.45 },
  late: {
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: ink.danger,
  },
  // Beside the clock, not over its figure.
  plusOne: { position: "absolute", right: RING_SIZE + space.s8, top: 0 },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  done: { alignItems: "center", gap: space.s12, paddingVertical: space.s12 },
  stamp: {
    paddingHorizontal: space.s8,
    paddingVertical: space.s4,
    borderWidth: 3,
    borderColor: ink.rubric,
    borderRadius: radii.sm,
    transform: [{ rotate: "-8deg" }],
  },
  stampText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.titleSmall,
    letterSpacing: 3,
    color: ink.rubric,
  },
  control: { height: 54, minWidth: 220, paddingHorizontal: space.s8 },
  error: { alignItems: "center", gap: space.s6 },
});

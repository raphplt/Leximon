import { type Catalog, cardOrPlaceholder } from "@leximon/contract/client";
import { TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import { effects, room, type ToyMatterName, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  answerTitle,
  bonusLines,
  frequencyLine,
  hideWordIn,
  levelUpLabel,
  levelUpLine,
  PACK_NOUNS,
  PRACTICE_FREE_HINT,
  questionKicker,
  spellingLine,
  typedQuestionHint,
} from "@leximon/view-model";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewInstance,
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Desk } from "@/library/play-pieces";
import { wordMemory } from "@/player/collection";
import { useShared } from "@/player/shared";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { useOptionalStage } from "@/ui/stage";
import { TextButton } from "@/ui/text-button";
import { Leaf, Lettering, toyFace } from "@/ui/toy";
import type { Session, Step } from "./session";

type ChoiceState = "idle" | "pending" | "right" | "wrong" | "faded";

/** In « La Bibliothèque », each answer is a tile of paper, of green or red leather once judged. */
const CHOICE_MATTERS: Readonly<Record<ChoiceState, ToyMatterName>> = {
  idle: "paper",
  pending: "paper",
  right: "green",
  wrong: "red",
  faded: "paper",
};

/** The prompt, the answers and the verdict are read on paper in « La Bibliothèque ». */
const ink = paperColors;

function choiceState(choiceId: string, answerId: string, step: Step): ChoiceState {
  if (step.name === "asking" || step.name === "recap") return "idle";
  if (step.name === "sending") return choiceId === step.chosen ? "pending" : "idle";
  if (choiceId === answerId) return "right";
  return choiceId === step.chosen ? "wrong" : "faded";
}

/** One question of a session: the prompt, the choices or the field, then what the answer did. */
export function QuestionView({
  catalog,
  session,
  error,
  onChoose,
  onNext,
  onQuit,
}: {
  readonly catalog: Catalog;
  readonly session: Session;
  readonly error: string | null;
  readonly onChoose: (chosen: string) => void;
  readonly onNext: () => void;
  readonly onQuit: () => void;
}) {
  const memory = useShared(wordMemory);
  const scroll = useRef<ScrollViewInstance>(null);
  const answered = session.step.name === "answered";
  // The verdict lands under the choices: brought into view, with its button.
  useEffect(() => {
    if (answered) scroll.current?.scrollToEnd({ animated: true });
  }, [answered]);
  // A right answer throws a few sparks of gold and green from its tile.
  const stage = useOptionalStage();
  const rightRef = useRef<ViewInstance>(null);
  const lastAnswer = session.step.name === "answered" ? session.answers.at(-1) : undefined;
  const right = lastAnswer?.correct === true;
  useEffect(() => {
    if (!right || stage === null) return;
    rightRef.current?.measureInWindow((x, y, width, height) =>
      stage.burst(x + width / 2, y + height / 2, effects.right),
    );
  }, [right, stage]);
  const question = session.questions[session.index];
  if (question === undefined) return null;
  const card = cardOrPlaceholder(catalog, question.cardId, "common");
  const asksDefinition = question.format === "definition";
  const level = memory?.get(question.cardId)?.level ?? "sketch";
  const total = session.questions.length;
  const last = session.index + 1 === total;
  const step = session.step;
  const result = step.name === "answered" ? (session.answers.at(-1) ?? null) : null;
  const slip = step.name === "answered" && step.slip;
  const spelling =
    result?.correct && question.format === "typed" && step.name === "answered"
      ? spellingLine(step.chosen, card.word)
      : null;

  const prompt = (
    <>
      <Text style={styles.kicker}>{questionKicker(question.format).toUpperCase()}</Text>
      {asksDefinition ? (
        <Text style={styles.promptWord} accessibilityRole="header">
          {card.word}
        </Text>
      ) : (
        <Text style={styles.promptDefinition} accessibilityRole="header">
          {result === null ? hideWordIn(card.definition, card.word) : card.definition}
        </Text>
      )}
      {question.format === "typed" && result === null && (
        <Text style={styles.hint}>{typedQuestionHint(level)}</Text>
      )}
      {question.counted === false && result === null && (
        <Text style={styles.hint}>{PRACTICE_FREE_HINT}</Text>
      )}
    </>
  );

  const page = (
    <ScrollView
      ref={scroll}
      contentContainerStyle={[styles.page, IS_LIBRARY && library.page]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <Pressable
          onPress={onQuit}
          accessibilityRole="button"
          accessibilityLabel="Arrêter le défi"
          style={[styles.round, IS_LIBRARY && [library.round, toyFace("paper", "round")]]}
        >
          <Icon name="close" size={20} color={IS_LIBRARY ? ink.pageInk : colors.pageInk} />
        </Pressable>
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {session.questions.map((q, index) => {
            const answer = session.answers[index];
            const tone =
              answer !== undefined
                ? answer.correct
                  ? DOTS.right
                  : DOTS.wrong
                : index === session.index
                  ? DOTS.current
                  : DOTS.waiting;
            return (
              <View
                key={q.cardId}
                style={[styles.dot, IS_LIBRARY && library.dot, { backgroundColor: tone }]}
              />
            );
          })}
        </View>
        <View>
          {IS_LIBRARY ? (
            <Lettering size={17}>{`${session.index + 1}/${total}`}</Lettering>
          ) : (
            <Text style={styles.position}>
              {session.index + 1}/{total}
            </Text>
          )}
          {result?.correct && result.progress.xpGained > 0 && (
            <XpFloat key={session.answers.length} xp={result.progress.xpGained} />
          )}
        </View>
      </View>

      {IS_LIBRARY ? <Leaf style={library.prompt}>{prompt}</Leaf> : <Panel>{prompt}</Panel>}

      {question.format === "typed" ? (
        <TypedAnswer
          key={question.cardId}
          step={step}
          correct={result?.correct ?? null}
          onAnswer={onChoose}
        />
      ) : (
        <View style={styles.choices}>
          {question.choices.map((choiceId, index) => {
            const choice = cardOrPlaceholder(catalog, choiceId, "common");
            const state = choiceState(choiceId, question.cardId, step);
            const judged = state === "right" || state === "wrong";
            return (
              <Reaction key={choiceId} kind={state}>
                <Pressable
                  ref={state === "right" ? rightRef : undefined}
                  disabled={step.name !== "asking"}
                  onPress={() => onChoose(choiceId)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.choice,
                    choiceStyles[state],
                    pressed && styles.choicePressed,
                    IS_LIBRARY && [
                      library.choice,
                      toyFace(CHOICE_MATTERS[state], "tile"),
                      state === "pending" && library.pending,
                      state === "faded" && library.faded,
                      pressed && library.pressed,
                    ],
                  ]}
                >
                  {IS_LIBRARY && (
                    <View style={[library.disc, toyFace("gold", "round")]}>
                      <Lettering size={15}>{String.fromCharCode(97 + index)}</Lettering>
                    </View>
                  )}
                  <Text
                    style={[
                      asksDefinition ? styles.choiceDefinition : styles.choiceWord,
                      IS_LIBRARY && library.choiceText,
                      IS_LIBRARY && judged && library.onLeather,
                    ]}
                  >
                    {asksDefinition ? choice.definition : choice.word}
                  </Text>
                </Pressable>
              </Reaction>
            );
          })}
        </View>
      )}

      {error !== null && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {result !== null && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[
            styles.feedback,
            result.correct ? styles.good : styles.bad,
            IS_LIBRARY && [library.feedback, result.correct ? library.good : library.bad],
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.feedbackTitle}>
            {answerTitle(result.correct, result.progress.xpGained, slip)}
          </Text>
          <Text style={styles.feedbackText}>
            {result.correct
              ? (spelling ?? frequencyLine(card.perBillion))
              : `La bonne réponse était « ${asksDefinition ? card.definition : card.word} »`}
          </Text>
          {result.levelUp && (
            <Animated.Text
              entering={FadeInUp.delay(200).duration(240)}
              style={[styles.feedbackExtra, styles.risen]}
            >
              {levelUpLine(card.word, result.level)}
            </Animated.Text>
          )}
          {[levelUpLabel(result.progress), ...bonusLines(result.bonus, PACK_NOUNS.sachet)].map(
            (line) =>
              line !== null && (
                <Text key={line} style={styles.feedbackExtra}>
                  {line}
                </Text>
              ),
          )}
          <Button label={last ? "Voir le résultat" : "Question suivante"} onPress={onNext} />
        </Animated.View>
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      {IS_LIBRARY ? (
        <View style={library.room}>
          <Desk style={StyleSheet.absoluteFill} />
          {/* The questions slide under the frame, not over it. */}
          <View style={library.inside}>{page}</View>
        </View>
      ) : (
        page
      )}
    </KeyboardAvoidingView>
  );
}

/** A right choice swells for a moment, a wrong one shakes once; nothing with reduced motion. */
function Reaction({
  kind,
  children,
}: {
  readonly kind: ChoiceState;
  readonly children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    if (kind === "right") {
      scale.value = withSequence(
        withTiming(1.04, { duration: 130 }),
        withTiming(1, { duration: 130 }),
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

/** « +15 XP » leaves the counter upwards and fades. */
function XpFloat({ xp }: { readonly xp: number }) {
  const reduced = useReducedMotion();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 900 });
  }, [rise]);
  const style = useAnimatedStyle(() => ({
    opacity: rise.value < 0.2 ? rise.value * 5 : 1 - (rise.value - 0.2) / 0.8,
    transform: [{ translateY: -22 * rise.value }],
  }));
  if (reduced) return null;
  return (
    <Animated.Text
      style={[styles.xpFloat, style]}
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      +{xp} XP
    </Animated.Text>
  );
}

/** The word typed from memory: sent with the button, or empty with « Je sèche ». */
function TypedAnswer({
  step,
  correct,
  onAnswer,
}: {
  readonly step: Step;
  readonly correct: boolean | null;
  readonly onAnswer: (typed: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const asking = step.name === "asking";
  const submit = () => {
    if (typed.trim() !== "") onAnswer(typed);
  };
  return (
    <View style={styles.typed}>
      <TextInput
        style={[
          styles.typedField,
          correct === true && styles.typedRight,
          correct === false && styles.typedWrong,
          IS_LIBRARY && library.typedField,
          IS_LIBRARY &&
            correct !== null && [
              library.onLeather,
              correct ? library.typedRight : library.typedWrong,
            ],
        ]}
        value={step.name === "answered" ? step.chosen : typed}
        onChangeText={setTyped}
        maxLength={TYPED_ANSWER_MAX_LENGTH}
        accessibilityLabel="Le mot"
        placeholder="Le mot"
        placeholderTextColor={ink.pageInkFaint}
        selectionColor={colors.rubric}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoFocus
        editable={asking}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      {asking && (
        <>
          <Button label="Valider le mot" disabled={typed.trim() === ""} onPress={submit} />
          <TextButton label="Je sèche" onPress={() => onAnswer("")} />
        </>
      )}
    </View>
  );
}

const choiceStyles = StyleSheet.create({
  idle: {},
  pending: { borderColor: colors.gilt },
  right: { borderColor: colors.success, backgroundColor: alpha(colors.success, 0.18) },
  wrong: { borderColor: colors.danger, backgroundColor: alpha(colors.danger, 0.16) },
  faded: { opacity: 0.45 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: {
    gap: space.s7,
    paddingHorizontal: space.s8,
    paddingTop: space.s4,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  top: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageRaised,
  },
  dots: { flex: 1, flexDirection: "row", justifyContent: "center", gap: space.s3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  position: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: colors.pageInkMuted },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  promptWord: {
    fontFamily: fonts.display,
    fontSize: fontSizes.headingLarge,
    lineHeight: 40,
    color: ink.pageInk,
  },
  promptDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.titleSmall,
    lineHeight: 28,
    color: ink.pageInk,
  },
  hint: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: ink.pageInkMuted,
  },
  choices: { gap: space.s5 },
  choice: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: space.s8,
    paddingVertical: space.s6,
    borderRadius: radii.xxl,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.pageRaised,
  },
  choicePressed: { borderColor: colors.gilt },
  choiceWord: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  choiceDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInk,
  },
  typed: { gap: space.s6 },
  typedField: {
    minHeight: 60,
    paddingHorizontal: space.s9,
    borderRadius: radii.xxl,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.well,
    color: colors.pageInk,
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    textAlign: "center",
  },
  typedRight: { borderColor: colors.success },
  typedWrong: { borderColor: colors.danger },
  error: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.danger,
  },
  feedback: { gap: space.s4, padding: space.s9, borderRadius: 20, borderWidth: 2 },
  good: { borderColor: colors.success, backgroundColor: alpha(colors.success, 0.12) },
  bad: { borderColor: colors.danger, backgroundColor: alpha(colors.danger, 0.1) },
  feedbackTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    color: ink.pageInk,
  },
  feedbackText: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInk,
  },
  risen: { fontFamily: fonts.ui.extrabold },
  xpFloat: {
    position: "absolute",
    right: 0,
    bottom: "100%",
    width: 80,
    textAlign: "right",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    color: colors.rubric,
  },
  feedbackExtra: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.rubric,
  },
});

/** The field once judged, cut in green or red leather like a tile. */
function leather(matter: "green" | "red") {
  const { top, bottom, edge } = toyMatters[matter];
  // A text field on Android draws no gradient: the plain leather shows under it.
  return {
    backgroundColor: bottom,
    backgroundImage: `linear-gradient(180deg, ${top} 0%, ${top} 47%, ${bottom} 53%, ${bottom} 100%)`,
    boxShadow: `inset 0 -4px 0 ${edge}`,
  };
}

const DOTS = IS_LIBRARY
  ? {
      right: toyMatters.green.top,
      wrong: toyMatters.red.top,
      current: toyMatters.paper.top,
      waiting: toyMatters.dark.bottom,
    }
  : { right: colors.success, wrong: colors.danger, current: colors.rubric, waiting: colors.track };

/** « La Bibliothèque »: the questions asked on the desk, the answers as tiles of paper. */
const library = StyleSheet.create({
  room: { flex: 1, marginHorizontal: 6, marginBottom: TAB_BAR_RISE },
  inside: {
    flex: 1,
    margin: room.desk.frameWidth,
    borderRadius: room.desk.radius - room.desk.frameWidth,
    overflow: "hidden",
  },
  page: { paddingHorizontal: space.s6, paddingTop: space.s7, paddingBottom: space.s12 },
  round: { borderWidth: toyValues.outlineWidth },
  dot: { height: 12, borderWidth: 2, borderColor: toyValues.outline },
  prompt: { padding: space.s9, gap: space.s6 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    paddingHorizontal: space.s6,
    borderWidth: toyValues.outlineWidth,
    marginBottom: 4,
  },
  pending: { borderColor: toyMatters.gold.top },
  faded: { opacity: 0.55 },
  pressed: { transform: [{ translateY: 3 }] },
  disc: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  choiceText: { flex: 1 },
  onLeather: { color: colors.inkOnColor },
  typedField: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundColor: colors.paper,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
  typedRight: leather("green"),
  typedWrong: leather("red"),
  feedback: {
    overflow: "hidden",
    borderWidth: toyValues.outlineWidth,
    borderLeftWidth: 10,
    borderColor: toyValues.outline,
    borderRadius: 16,
    backgroundColor: colors.paper,
    boxShadow: `inset 0 -4px 0 ${toyMatters.paper.bottom}, 0 4px 0 ${toyValues.outline}`,
  },
  good: { borderLeftColor: toyMatters.green.bottom },
  bad: { borderLeftColor: toyMatters.red.bottom },
});

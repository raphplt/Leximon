import { type Catalog, cardOrPlaceholder } from "@leximon/contract/client";
import { TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
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
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { wordMemory } from "@/player/collection";
import { useShared } from "@/player/shared";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";
import type { Session, Step } from "./session";

type ChoiceState = "idle" | "pending" | "right" | "wrong" | "faded";

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

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          <Pressable
            onPress={onQuit}
            accessibilityRole="button"
            accessibilityLabel="Arrêter le défi"
            style={styles.round}
          >
            <Icon name="close" size={20} color={colors.pageInk} />
          </Pressable>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants">
            {session.questions.map((q, index) => {
              const answer = session.answers[index];
              const tone =
                answer !== undefined
                  ? answer.correct
                    ? colors.success
                    : colors.danger
                  : index === session.index
                    ? colors.rubric
                    : colors.track;
              return <View key={q.cardId} style={[styles.dot, { backgroundColor: tone }]} />;
            })}
          </View>
          <View>
            <Text style={styles.position}>
              {session.index + 1}/{total}
            </Text>
            {result?.correct && result.progress.xpGained > 0 && (
              <XpFloat key={session.answers.length} xp={result.progress.xpGained} />
            )}
          </View>
        </View>

        <Panel>
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
        </Panel>

        {question.format === "typed" ? (
          <TypedAnswer
            key={question.cardId}
            step={step}
            correct={result?.correct ?? null}
            onAnswer={onChoose}
          />
        ) : (
          <View style={styles.choices}>
            {question.choices.map((choiceId) => {
              const choice = cardOrPlaceholder(catalog, choiceId, "common");
              const state = choiceState(choiceId, question.cardId, step);
              return (
                <Reaction key={choiceId} kind={state}>
                  <Pressable
                    disabled={step.name !== "asking"}
                    onPress={() => onChoose(choiceId)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.choice,
                      choiceStyles[state],
                      pressed && styles.choicePressed,
                    ]}
                  >
                    <Text style={asksDefinition ? styles.choiceDefinition : styles.choiceWord}>
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
            style={[styles.feedback, result.correct ? styles.good : styles.bad]}
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
        ]}
        value={step.name === "answered" ? step.chosen : typed}
        onChangeText={setTyped}
        maxLength={TYPED_ANSWER_MAX_LENGTH}
        accessibilityLabel="Le mot"
        placeholder="Le mot"
        placeholderTextColor={colors.pageInkFaint}
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
    color: colors.pageInkMuted,
  },
  promptWord: {
    fontFamily: fonts.display,
    fontSize: fontSizes.headingLarge,
    lineHeight: 40,
    color: colors.pageInk,
  },
  promptDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.titleSmall,
    lineHeight: 28,
    color: colors.pageInk,
  },
  hint: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: colors.pageInkMuted,
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
  choiceWord: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.pageInk },
  choiceDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: colors.pageInk,
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
    color: colors.pageInk,
  },
  feedbackText: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: colors.pageInk,
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
    color: colors.rubric,
  },
});

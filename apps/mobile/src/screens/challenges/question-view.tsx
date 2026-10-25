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
  questionKicker,
  spellingLine,
  typedQuestionHint,
} from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
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
import { wordMemory } from "@/player/collection";
import { useShared } from "@/player/shared";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
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
            <Icon name="close" size={20} color={colors.text} />
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
                    ? colors.accent
                    : colors.track;
              return <View key={q.cardId} style={[styles.dot, { backgroundColor: tone }]} />;
            })}
          </View>
          <Text style={styles.position}>
            {session.index + 1}/{total}
          </Text>
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
                <Pressable
                  key={choiceId}
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
          <View
            style={[styles.feedback, result.correct ? styles.good : styles.bad]}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.feedbackTitle}>
              {answerTitle(result.correct, result.progress.xpGained, slip)}
            </Text>
            <Text style={styles.feedbackText}>
              {result.correct
                ? (spelling ?? frequencyLine(card.perBillion))
                : `C'était : ${asksDefinition ? card.definition : card.word}`}
            </Text>
            {[
              result.levelUp ? levelUpLine(card.word, result.level) : null,
              levelUpLabel(result.progress),
              ...bonusLines(result.bonus, PACK_NOUNS.sachet),
            ].map(
              (line) =>
                line !== null && (
                  <Text key={line} style={styles.feedbackExtra}>
                    {line}
                  </Text>
                ),
            )}
            <Button label={last ? "Voir le résultat" : "Question suivante"} onPress={onNext} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
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
  pending: { borderColor: colors.accent },
  right: { borderColor: colors.success, backgroundColor: "rgba(47, 199, 155, 0.18)" },
  wrong: { borderColor: colors.danger, backgroundColor: "rgba(255, 156, 128, 0.16)" },
  faded: { opacity: 0.45 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: TAB_BAR_RISE + 24 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundRaised,
  },
  dots: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  position: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.textMuted },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  promptWord: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.text },
  promptDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
  },
  hint: { fontFamily: fonts.ui.medium, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  choices: { gap: 10 },
  choice: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.backgroundRaised,
  },
  choicePressed: { borderColor: colors.accent },
  choiceWord: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  choiceDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  typed: { gap: 12 },
  typedField: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.well,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    textAlign: "center",
  },
  typedRight: { borderColor: colors.success },
  typedWrong: { borderColor: colors.danger },
  error: { fontFamily: fonts.ui.bold, fontSize: 15, lineHeight: 21, color: colors.danger },
  feedback: { gap: 8, padding: 18, borderRadius: 20, borderWidth: 2 },
  good: { borderColor: colors.success, backgroundColor: "rgba(47, 199, 155, 0.12)" },
  bad: { borderColor: colors.danger, backgroundColor: "rgba(255, 156, 128, 0.1)" },
  feedbackTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  feedbackText: {
    fontFamily: fonts.text.regular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  feedbackExtra: { fontFamily: fonts.ui.bold, fontSize: 15, lineHeight: 21, color: colors.accent },
});

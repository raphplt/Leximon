import type { CatalogCard } from "@leximon/contract";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import { TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import { effects, room, type ToyMatterName, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  answerFeedback,
  answerTitle,
  bonusLines,
  CATCH_UP_HINT,
  frequencyLine,
  hideWordIn,
  LETTERS_ACTION,
  LETTERS_HINT,
  LETTERS_START,
  letterSlots,
  lettersSpelled,
  levelUpLabel,
  levelUpLine,
  MEET_ACTION,
  MEET_KICKER,
  PACK_NOUNS,
  PAIRS_START,
  type PairSide,
  PRACTICE_FREE_HINT,
  PRACTICE_TYPED_HINT,
  pairsDone,
  pairsVerdict,
  pickInPairs,
  placeTile,
  questionKicker,
  spellingLine,
  takeBackFrom,
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
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Card } from "@/cards/card";
import { SpeechButtons } from "@/cards/speech-buttons";
import { useSpokenWord } from "@/cards/spoken-word";
import { play, speechOn, vibrate } from "@/feedback/feedback";
import { Desk } from "@/library/play-pieces";
import { wordMemory } from "@/player/collection";
import { useShared } from "@/player/shared";
import { openCard } from "@/screens/trades/card-row";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { useOptionalStage } from "@/ui/stage";
import { TextButton } from "@/ui/text-button";
import { Leaf, Lettering, Toy, toyFace } from "@/ui/toy";
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
  if (step.name === "asking" || step.name === "meeting" || step.name === "recap") return "idle";
  if (step.name === "sending") return choiceId === step.chosen ? "pending" : "idle";
  if (choiceId === answerId) return "right";
  return choiceId === step.chosen ? "wrong" : "faded";
}

/** The word is said once the question has slid in, not over the last answer's sound. */
const SPEAK_AFTER_MS = 250;

/** The verdict stamped on the corner of the slip like a seal, at its own tilt. */
function stampIn(tilt: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 1.9 }, { rotate: `${tilt}deg` }] },
    55: { opacity: 1, transform: [{ scale: 0.9 }, { rotate: `${tilt}deg` }] },
    100: { opacity: 1, transform: [{ scale: 1 }, { rotate: `${tilt}deg` }] },
  }).duration(420);
}

/** The word asked, said by the catalogue's voice as the question comes, unless it is muted. */
function SpokenPrompt({ card }: { readonly card: CatalogCard }) {
  const word = useSpokenWord(card);
  // Each question is a fresh component (keyed by its card): the word is said once, as it comes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per question on purpose
  useEffect(() => {
    if (!speechOn()) return;
    const timer = setTimeout(word.play, SPEAK_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <Text style={styles.promptWord} accessibilityRole="header">
        {card.word}
      </Text>
      <View style={styles.speech}>
        <SpeechButtons word={word} label={card.word} />
      </View>
    </>
  );
}

/** A word to recognise by ear: said as it comes, written only once answered. */
function HeardPrompt({ card, shown }: { readonly card: CatalogCard; readonly shown: boolean }) {
  const word = useSpokenWord(card);
  // biome-ignore lint/correctness/useExhaustiveDependencies: said once, as the question comes
  useEffect(() => {
    const timer = setTimeout(word.play, SPEAK_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      {shown ? (
        <Text style={styles.promptWord} accessibilityRole="header">
          {card.word}
        </Text>
      ) : (
        <Text style={styles.spoken} accessibilityRole="header">
          Le mot est dit à voix haute.
        </Text>
      )}
      <View style={styles.heard}>
        {IS_LIBRARY ? (
          <Toy
            matter="gold"
            shape="round"
            style={styles.heardButton}
            accessibilityRole="button"
            accessibilityLabel="Réécouter le mot"
            onPress={word.play}
          >
            <Icon name="sound" size={34} color={toyValues.outline} />
          </Toy>
        ) : (
          <Pressable
            onPress={word.play}
            accessibilityRole="button"
            accessibilityLabel="Réécouter le mot"
            style={({ pressed }) => [
              styles.heardButton,
              styles.heardClassic,
              pressed && styles.choicePressed,
            ]}
          >
            <Icon name="sound" size={34} color={colors.actionInk} />
          </Pressable>
        )}
      </View>
    </>
  );
}

/** A new word: its card first, said aloud, then its question. */
function Meeting({
  catalog,
  card,
  onMeet,
}: {
  readonly catalog: Catalog;
  readonly card: CatalogCard;
  readonly onMeet: () => void;
}) {
  const word = useSpokenWord(card);
  // biome-ignore lint/correctness/useExhaustiveDependencies: said once, as the card comes
  useEffect(() => {
    if (!speechOn()) return;
    const timer = setTimeout(word.play, SPEAK_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const content = (
    <>
      <Text style={styles.kicker}>{MEET_KICKER.toUpperCase()}</Text>
      <View style={styles.meetingCard}>
        <Card card={card} collectionName={collectionName(catalog, card.collectionId)} width={230} />
      </View>
      <View style={styles.speech}>
        <SpeechButtons word={word} label={card.word} />
      </View>
      <Button label={MEET_ACTION} onPress={onMeet} />
    </>
  );
  return IS_LIBRARY ? <Leaf style={library.prompt}>{content}</Leaf> : <Panel>{content}</Panel>;
}

/** One question of a series: the prompt, the choices or the field, then what the answer did. */
export function QuestionView({
  catalog,
  session,
  error,
  onMeet,
  onChoose,
  onNext,
  onQuit,
}: {
  readonly catalog: Catalog;
  readonly session: Session;
  readonly error: string | null;
  readonly onMeet: () => void;
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
  // The choices are definitions when the word is shown or heard.
  const asksDefinition = question.format === "definition" || question.format === "listen";
  const pairs = question.format === "pairs";
  const level = memory?.get(question.cardId)?.level ?? "blank";
  const total = session.questions.length;
  const last = session.index + 1 === total;
  const step = session.step;
  const result = step.name === "answered" ? (session.answers.at(-1) ?? null) : null;
  const slip = step.name === "answered" && step.slip;
  const mistakes = pairs && step.name === "answered" ? Number(step.chosen) : 0;
  // Every pair is found in the end: a round with mistakes is not a failure.
  const verdictMatter: ToyMatterName =
    result === null || result.correct ? "green" : pairs ? "gold" : "red";
  const spelling =
    result?.correct && question.format === "typed" && step.name === "answered"
      ? spellingLine(step.chosen, card.word)
      : null;

  const prompt = (
    <>
      <Text style={styles.kicker}>{questionKicker(question.format).toUpperCase()}</Text>
      {question.format === "definition" ? (
        <SpokenPrompt key={question.cardId} card={card} />
      ) : question.format === "listen" ? (
        <HeardPrompt key={question.cardId} card={card} shown={result !== null} />
      ) : pairs ? null : (
        <Text style={styles.promptDefinition} accessibilityRole="header">
          {result === null ? hideWordIn(card.definition, card.word) : card.definition}
        </Text>
      )}
      {question.format === "typed" && result === null && (
        <Text style={styles.hint}>
          {question.counted ? typedQuestionHint(level) : PRACTICE_TYPED_HINT}
        </Text>
      )}
      {question.format === "letters" && result === null && (
        <Text style={styles.hint}>{LETTERS_HINT}</Text>
      )}
      {result === null && !pairs && (question.catchUp || !question.counted) && (
        <Text style={styles.hint}>{question.catchUp ? CATCH_UP_HINT : PRACTICE_FREE_HINT}</Text>
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
            // A missed word asked again comes back as a smaller dot.
            return (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: one dot per question, in order
                key={index}
                style={[
                  styles.dot,
                  IS_LIBRARY && library.dot,
                  q.catchUp && (IS_LIBRARY ? library.catchUpDot : styles.catchUpDot),
                  { backgroundColor: tone },
                ]}
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

      {step.name === "meeting" ? (
        <Meeting key={question.cardId} catalog={catalog} card={card} onMeet={onMeet} />
      ) : IS_LIBRARY ? (
        <Leaf style={library.prompt}>{prompt}</Leaf>
      ) : (
        <Panel>{prompt}</Panel>
      )}

      {step.name === "meeting" ? null : question.format === "typed" ? (
        <TypedAnswer
          key={question.cardId}
          step={step}
          correct={result?.correct ?? null}
          onAnswer={onChoose}
        />
      ) : question.format === "letters" ? (
        <LettersAnswer
          key={question.cardId}
          tiles={question.tiles}
          slots={letterSlots(card.word)}
          step={step}
          correct={result?.correct ?? null}
          onAnswer={onChoose}
        />
      ) : question.format === "pairs" ? (
        <PairsRound
          key={question.cardId}
          catalog={catalog}
          cards={question.cards}
          definitions={question.definitions}
          done={step.name !== "asking"}
          onDone={(count) => onChoose(String(count))}
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
            result.correct ? styles.good : pairs ? styles.even : styles.bad,
            IS_LIBRARY && library.feedback,
          ]}
          accessibilityLiveRegion="polite"
        >
          {IS_LIBRARY && (
            <Animated.View
              entering={stampIn(result.correct ? -10 : 8)}
              style={[
                library.verdict,
                toyFace(verdictMatter, "round"),
                { transform: [{ rotate: `${result.correct ? -10 : 8}deg` }] },
              ]}
            >
              <Icon
                name={result.correct || pairs ? "check" : "close"}
                size={24}
                color={colors.inkOnColor}
              />
            </Animated.View>
          )}
          <View style={styles.verdictRow}>
            <View style={styles.verdictLines}>
              <Text
                style={[
                  styles.feedbackTitle,
                  IS_LIBRARY && [library.verdictTitle, { color: toyMatters[verdictMatter].edge }],
                ]}
              >
                {pairs && !result.correct
                  ? pairsVerdict(mistakes)
                  : answerTitle(result.correct, result.progress.xpGained, slip)}
              </Text>
              {(!pairs || result.correct) && (
                <Text style={styles.feedbackText}>
                  {pairs
                    ? pairsVerdict(mistakes)
                    : result.correct
                      ? (spelling ?? frequencyLine(card.perBillion))
                      : `La bonne réponse était « ${asksDefinition ? card.definition : card.word} »`}
                </Text>
              )}
            </View>
            {/* After a mistake, the card itself: the player sees again the thing they own. */}
            {!result.correct && !pairs && (
              <Pressable
                onPress={() => openCard(card.id)}
                accessibilityRole="button"
                accessibilityLabel={`Voir la carte ${card.word}`}
                style={styles.missedCard}
              >
                <View importantForAccessibility="no-hide-descendants">
                  <Card
                    card={card}
                    collectionName={collectionName(catalog, card.collectionId)}
                    width={72}
                  />
                </View>
              </Pressable>
            )}
          </View>
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

/** The word rebuilt from its tiles: a tile goes to the next slot, a slot gives its tile back. */
function LettersAnswer({
  tiles,
  slots,
  step,
  correct,
  onAnswer,
}: {
  readonly tiles: readonly string[];
  readonly slots: number;
  readonly step: Step;
  readonly correct: boolean | null;
  readonly onAnswer: (spelled: string) => void;
}) {
  const [state, setState] = useState(LETTERS_START);
  const asking = step.name === "asking";
  const full = state.placed.length === slots;
  const judged = correct !== null;
  return (
    <View style={styles.letters}>
      <View
        style={[
          styles.slots,
          judged &&
            (IS_LIBRARY
              ? [library.slotsJudged, correct ? library.typedRight : library.typedWrong]
              : correct
                ? choiceStyles.right
                : choiceStyles.wrong),
        ]}
      >
        {Array.from({ length: slots }, (_, slot) => {
          const index = state.placed[slot];
          const letter = index === undefined ? "" : (tiles[index] ?? "");
          return (
            <Pressable
              // biome-ignore lint/suspicious/noArrayIndexKey: one slot per letter, in order
              key={slot}
              disabled={!asking || index === undefined}
              onPress={() => setState((current) => takeBackFrom(current, slot))}
              accessibilityRole="button"
              accessibilityLabel={letter === "" ? `Case ${slot + 1}, vide` : `Retirer ${letter}`}
              style={[
                styles.slot,
                judged && styles.slotJudged,
                IS_LIBRARY && judged && library.slotOnLeather,
              ]}
            >
              <Text style={[styles.letter, IS_LIBRARY && judged && library.onLeather]}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tiles}>
        {tiles.map((tile, index) => {
          const placed = state.placed.includes(index);
          return (
            <Pressable
              // biome-ignore lint/suspicious/noArrayIndexKey: a letter may come twice
              key={index}
              disabled={!asking || placed}
              onPress={() => setState((current) => placeTile(current, index, slots))}
              accessibilityRole="button"
              accessibilityLabel={tile}
              style={({ pressed }) => [
                styles.tile,
                pressed && styles.choicePressed,
                IS_LIBRARY && [library.tile, toyFace("paper", "tile"), pressed && library.pressed],
                placed && styles.tilePlaced,
              ]}
            >
              <Text style={styles.letter}>{tile}</Text>
            </Pressable>
          );
        })}
      </View>
      {asking && (
        <>
          <Button
            label={LETTERS_ACTION}
            disabled={!full}
            onPress={() => onAnswer(lettersSpelled(state, tiles))}
          />
          <TextButton label="Je sèche" onPress={() => onAnswer("")} />
        </>
      )}
    </View>
  );
}

/** A mismatch in a round of pairs sounds and buzzes like a wrong answer. */
const MISMATCH = answerFeedback({
  correct: false,
  levelUp: false,
  bonus: { daily: 0, gilded: 0, credited: 0, reserve: 0 },
});

/** Words and their definitions: a word, then its definition, until every pair is found. */
function PairsRound({
  catalog,
  cards,
  definitions,
  done,
  onDone,
}: {
  readonly catalog: Catalog;
  readonly cards: readonly string[];
  readonly definitions: readonly string[];
  readonly done: boolean;
  readonly onDone: (mistakes: number) => void;
}) {
  const [state, setState] = useState(PAIRS_START);
  const pick = (side: PairSide, cardId: string) => {
    if (done) return;
    const next = pickInPairs(state, side, cardId);
    setState(next);
    if (next.wrong !== null) {
      play(MISMATCH.cue);
      vibrate(MISMATCH.vibration);
    } else if (next.matched.length > state.matched.length) {
      play("answerRight");
    }
    if (pairsDone(next, cards)) onDone(next.mistakes);
  };
  const stateOf = (side: PairSide, cardId: string): ChoiceState => {
    if (state.matched.includes(cardId)) return "right";
    if (state.picked?.side === side && state.picked.cardId === cardId) return "pending";
    const wrong = side === "word" ? state.wrong?.word : state.wrong?.definition;
    return wrong === cardId ? "wrong" : "idle";
  };
  return (
    <View style={styles.pairs}>
      {(["word", "definition"] as const).map((side) => (
        <View key={side} style={side === "word" ? styles.pairWords : styles.pairDefinitions}>
          {(side === "word" ? cards : definitions).map((cardId) => {
            const card = cardOrPlaceholder(catalog, cardId, "common");
            const tone = stateOf(side, cardId);
            const judged = tone === "right" || tone === "wrong";
            return (
              <Reaction key={cardId} kind={tone}>
                <Pressable
                  disabled={done || state.matched.includes(cardId)}
                  onPress={() => pick(side, cardId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tone === "pending" }}
                  style={({ pressed }) => [
                    styles.pair,
                    choiceStyles[tone],
                    pressed && styles.choicePressed,
                    IS_LIBRARY && [
                      library.pair,
                      toyFace(CHOICE_MATTERS[tone], "tile"),
                      tone === "pending" && library.pending,
                      pressed && library.pressed,
                    ],
                  ]}
                >
                  <Text
                    style={[
                      side === "word" ? styles.pairWord : styles.pairDefinition,
                      IS_LIBRARY && judged && library.onLeather,
                    ]}
                  >
                    {side === "word" ? card.word : hideWordIn(card.definition, card.word)}
                  </Text>
                </Pressable>
              </Reaction>
            );
          })}
        </View>
      ))}
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
  // Up to twenty questions and their catch-ups: the row wraps rather than run off the screen.
  dots: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s2,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catchUpDot: { width: 6, height: 6, borderRadius: 3 },
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
  speech: { flexDirection: "row", gap: space.s4 },
  meetingCard: { alignItems: "center" },
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
  letters: { gap: space.s8 },
  slots: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.s2,
    padding: space.s5,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: "transparent",
  },
  slot: {
    width: 30,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderBottomWidth: 3,
    borderBottomColor: ink.pageInkFaint,
    backgroundColor: ink.well,
  },
  slotJudged: { backgroundColor: "transparent", borderBottomColor: ink.pageInkMuted },
  letter: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s4 },
  tile: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.pageRaised,
  },
  tilePlaced: { opacity: 0.25 },
  // Narrow words beside wider definitions: both columns fit a small phone.
  pairs: { flexDirection: "row", gap: space.s3 },
  pairWords: { flex: 1, gap: space.s3 },
  pairDefinitions: { flex: 1.4, gap: space.s3 },
  pair: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: space.s4,
    paddingVertical: space.s5,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.track,
    backgroundColor: colors.pageRaised,
  },
  pairWord: { fontFamily: fonts.display, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  pairDefinition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: ink.pageInk,
  },
  spoken: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInkMuted,
  },
  heard: { alignItems: "center", marginTop: space.s4 },
  heardButton: { width: 88, height: 88 },
  heardClassic: {
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.action,
  },
  error: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.danger,
  },
  feedback: { gap: space.s4, padding: space.s9, borderRadius: 20, borderWidth: 2 },
  good: { borderColor: colors.success, backgroundColor: alpha(colors.success, 0.12) },
  bad: { borderColor: colors.danger, backgroundColor: alpha(colors.danger, 0.1) },
  even: { borderColor: colors.gilt, backgroundColor: alpha(colors.gilt, 0.12) },
  verdictRow: { flexDirection: "row", alignItems: "flex-start", gap: space.s6 },
  verdictLines: { flex: 1, gap: space.s4 },
  missedCard: { transform: [{ rotate: "3deg" }] },
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
  catchUpDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
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
  tile: { borderWidth: toyValues.outlineWidth, borderColor: toyValues.outline, marginBottom: 4 },
  slotsJudged: { borderWidth: toyValues.outlineWidth, borderColor: toyValues.outline },
  slotOnLeather: { borderBottomColor: colors.inkOnColor },
  pair: { borderWidth: toyValues.outlineWidth, marginBottom: 4 },
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
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 16,
    backgroundColor: colors.paper,
    boxShadow: `inset 0 -4px 0 ${toyMatters.paper.bottom}, 0 4px 0 ${toyValues.outline}`,
  },
  /** Clear of the seal on the corner; the lines under it run the slip's whole width. */
  verdictTitle: { paddingLeft: 30 },
  verdict: {
    position: "absolute",
    top: -14,
    left: -10,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});

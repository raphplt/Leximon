"use client";

import type { CatalogCard, ReviewRequest } from "@leximon/contract";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import { TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import { effects } from "@leximon/tokens";
import {
  AFTER_ANSWER_MS,
  type AnsweredQuestion,
  answerFeedback,
  answerTitle,
  bonusLines,
  CATCH_UP_HINT,
  CHOICE_SHORTCUTS,
  choiceIndexOfKey,
  clanAnswers,
  clanShareLine,
  climbedWords,
  comingBackLine,
  comingBackTomorrow,
  freeAnswerOutcome,
  frequencyLine,
  hideWordIn,
  KEYBOARD_HELP,
  type KeyShortcut,
  levelUpLabel,
  levelUpLine,
  MEET_ACTION,
  MEET_KICKER,
  NOT_THIS_TIME,
  noChallengeNotice,
  PAIRS_START,
  type PairSide,
  PRACTICE_FREE_HINT,
  PRACTICE_REFUSED,
  PRACTICE_TYPED_HINT,
  pairsDone,
  pairsVerdict,
  perfectStartToast,
  pickInPairs,
  playable,
  questionKicker,
  RECAP_BONUS_MS,
  recapActions,
  type SeriesQuestion,
  scoredAnswers,
  seriesOf,
  sessionBonusLine,
  sessionScore,
  sessionXpLine,
  spellingLine,
  streakLine,
  TYPED_SHORTCUTS,
  typedQuestionHint,
  withCatchUp,
} from "@leximon/view-model";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { play, speechOn, vibrate } from "@/booster/feedback";
import { loadCatalog } from "@/cards/catalog";
import { SpeechButtons } from "@/cards/speech-buttons";
import { useSpokenWord } from "@/cards/use-spoken-word";
import { Card } from "@/components/card";
import { api } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { usePackShape } from "@/lib/use-pack-shape";
import { Desk } from "@/library/play-pieces";
import { myClan } from "@/player/clan";
import { dailyChallenge, refreshIfRead, reviewSummary, wordMemory } from "@/player/collection";
import { publishEcusWon } from "@/player/missions";
import { missions } from "@/player/player";
import { useShared } from "@/player/resource";
import { publishProgress } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { Button, ButtonLink, RoundButton } from "@/ui/button";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { ParticleStage, useOptionalStage } from "@/ui/stage";
import { useToast } from "@/ui/toast";
import { Toy, ToyBody } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./challenge-screen.module.css";
import { takeAlbumPractice } from "./pending-practice";
import { ReviewDesk } from "./review-desk";

/** The word is said once the question has slid in, not over the last answer's sound. */
const SPEAK_AFTER_MS = 250;

/** `chosen`: the card picked, or the word typed. `meeting`: a new word's card, before its question. */
type Step =
  | { readonly name: "meeting" }
  | { readonly name: "asking" }
  | { readonly name: "sending"; readonly chosen: string }
  | { readonly name: "answered"; readonly chosen: string; readonly slip: boolean }
  | { readonly name: "recap" };

interface Session {
  readonly questions: readonly SeriesQuestion[];
  readonly answers: readonly AnsweredQuestion[];
  readonly index: number;
  readonly step: Step;
  /** What started it, to start another of the same kind from the recap. */
  readonly request: ReviewRequest;
}

/** A new word shows its card first: the player meets it before being asked. */
function stepFor(question: SeriesQuestion | undefined): Step {
  return question?.fresh === true ? { name: "meeting" } : { name: "asking" };
}

/**
 * Défis: the review of the player's words, the shelf of scopes to practise on, the daily
 * challenge, the riddle and the memory by level; then the series of questions themselves.
 */
export function ChallengeScreen() {
  return (
    <ParticleStage>
      <ChallengeFlow />
    </ParticleStage>
  );
}

function ChallengeFlow() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never counts an answer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { noun } = usePackShape();
  const now = useNow(60_000);
  const params = useSearchParams();
  const word = params.get("mot");
  const fromAlbum = params.has("revision");
  const memory = useShared(wordMemory);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const loadIt = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError("Les cartes n'ont pas pu être chargées. Réessaie."));
  }, []);
  useEffect(loadIt, [loadIt]);

  const start = useCallback(
    async (request: ReviewRequest) => {
      setStarting(true);
      setNotice(null);
      setError(null);
      try {
        const series = await api.startReview(request);
        if (series.kind === "refused") {
          setNotice(PRACTICE_REFUSED);
        } else if (series.questions.length === 0) {
          setNotice(noChallengeNotice(null, Date.now(), noun));
        } else {
          // Without sound, a word to listen to is shown instead.
          const questions = seriesOf(series.questions).map((q) => playable(q, speechOn()));
          setSession({ questions, answers: [], index: 0, step: stepFor(questions[0]), request });
          window.scrollTo(0, 0);
        }
      } catch {
        setError("Le serveur ne répond pas. Réessaie.");
      } finally {
        setStarting(false);
      }
    },
    [noun],
  );

  // A word picked on Jouer opens the series; a filter of the album makes its scope.
  useEffect(() => {
    if (catalog === null) return;
    if (word !== null) {
      router.replace(pathname, { scroll: false });
      void start({ first: word });
    } else if (fromAlbum) {
      router.replace(pathname, { scroll: false });
      const cardIds = takeAlbumPractice();
      if (cardIds !== null) void start({ scope: { kind: "cards", cardIds: [...cardIds] } });
    }
  }, [word, fromAlbum, catalog, router, pathname, start]);

  /**
   * A word that counts goes through the review; free practice only earns its XP. `chosen` is the
   * card picked, the word typed, or the mistakes of a round of pairs.
   */
  const sendAnswer = async (question: SeriesQuestion, chosen: string, key: string) => {
    const { cardId } = question;
    if (question.counted && question.format !== "pairs") {
      return api.answerChallenge(
        question.format === "typed"
          ? { cardId, format: question.format, typed: chosen }
          : { cardId, format: question.format, chosenCardId: chosen },
        key,
      );
    }
    const free = await api.answerPractice(
      question.format === "pairs"
        ? { cardId, format: "pairs", mistakes: Number(chosen) }
        : question.format === "typed"
          ? { cardId, format: question.format, typed: chosen }
          : { cardId, chosenCardId: chosen, format: question.format },
      key,
    );
    if (free.kind === "not_owned") return { kind: "not_due" as const };
    const outcome = freeAnswerOutcome(memory?.get(cardId)?.level ?? "blank");
    return { ...free, ...outcome, bonus: free.bonus ?? outcome.bonus };
  };

  const choose = async (chosen: string) => {
    if (session === null || session.step.name !== "asking") return;
    const question = session.questions[session.index];
    if (question === undefined) return;
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setError(null);
    setSession({ ...session, step: { name: "sending", chosen } });
    try {
      const result = await sendAnswer(question, chosen, key);
      setPendingKey(null);
      refreshIfRead(wordMemory);
      refreshIfRead(missions);
      dailyChallenge.refresh();
      if (result.kind === "not_due") {
        advance({ ...session, step: { name: "asking" } });
        return;
      }
      publishProgress(result.progress);
      if (result.ecus > 0) {
        publishEcusWon(result.ecus);
        toast(perfectStartToast(result.ecus, Date.now()));
      }
      const feel = answerFeedback(result);
      play(feel.cue);
      vibrate(feel.vibration);
      const { followUp } = feel;
      if (followUp !== null) window.setTimeout(() => play(followUp), AFTER_ANSWER_MS);
      setSession({
        ...session,
        // A missed word comes back a few questions later, asked the other way round.
        questions: result.correct
          ? session.questions
          : withCatchUp(session.questions, session.index, Date.now()),
        answers: [
          ...session.answers,
          {
            cardId: question.cardId,
            correct: result.correct,
            levelUp: result.levelUp,
            level: result.level,
            bonus: result.bonus,
            progress: result.progress,
            free: !question.counted,
          },
        ],
        step: { name: "answered", chosen, slip: result.slip },
      });
    } catch {
      setError("Ta réponse n'est pas partie. Vérifie ta connexion.");
      setSession({ ...session, step: { name: "asking" } });
    }
  };

  const advance = (current: Session) => {
    const next = current.questions[current.index + 1];
    setSession(
      next !== undefined
        ? { ...current, index: current.index + 1, step: stepFor(next) }
        : { ...current, step: { name: "recap" } },
    );
  };

  const quit = () => {
    setSession(null);
    setError(null);
    reviewSummary.refresh();
    window.scrollTo(0, 0);
  };

  if (session !== null && catalog !== null) {
    return (
      <main className={styles.page}>
        {session.step.name === "recap" ? (
          <Recap
            catalog={catalog}
            answers={session.answers}
            series={session.questions}
            busy={starting}
            onMore={() => void start(session.request)}
            onBack={quit}
          />
        ) : (
          <QuestionView
            catalog={catalog}
            session={session}
            error={error}
            onMeet={() => setSession({ ...session, step: { name: "asking" } })}
            onChoose={(chosen) => void choose(chosen)}
            onNext={() => advance(session)}
            onQuit={quit}
          />
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {catalog !== null && (
        <ReviewDesk
          catalog={catalog}
          now={now}
          busy={starting}
          notice={notice}
          error={error}
          onStart={(request) => void start(request)}
        />
      )}
      {catalog === null && error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

type ChoiceState = "idle" | "pending" | "right" | "wrong" | "faded";

function choiceState(choiceId: string, answerId: string, step: Step): ChoiceState {
  if (step.name === "asking" || step.name === "meeting" || step.name === "recap") return "idle";
  if (step.name === "sending") return choiceId === step.chosen ? "pending" : "idle";
  if (choiceId === answerId) return "right";
  return choiceId === step.chosen ? "wrong" : "faded";
}

function QuestionView({
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
  readonly onChoose: (cardId: string) => void;
  readonly onNext: () => void;
  readonly onQuit: () => void;
}) {
  const { noun } = usePackShape();
  const memory = useShared(wordMemory);
  const stage = useOptionalStage();
  const quizRef = useRef<HTMLElement>(null);
  const step = session.step;
  const result = step.name === "answered" ? (session.answers.at(-1) ?? null) : null;
  const right = result?.correct === true;
  // Each right answer throws its spark from the answer itself.
  useEffect(() => {
    if (!right || stage === null) return;
    const box = quizRef.current?.querySelector("[data-right]")?.getBoundingClientRect();
    if (box === undefined) return;
    stage.burst(box.left + box.width / 2, box.top + box.height / 2, effects.right);
  }, [right, stage]);
  const question = session.questions[session.index];
  // Anki's keys: 1 to 4 (or a to d) answers, Enter goes on, Escape stops.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (session.answers.length === 0 || window.confirm("Arrêter la révision ?")) onQuit();
        return;
      }
      if (event.key === "Enter") {
        if (step.name === "meeting") onMeet();
        else if (step.name === "answered") onNext();
        else return;
        event.preventDefault();
        return;
      }
      // Letters typed in the word field are the answer, not a choice.
      if (event.target instanceof HTMLInputElement) return;
      const at = choiceIndexOfKey(event.key);
      if (at === null || step.name !== "asking" || question === undefined) return;
      if (!("choices" in question)) return;
      const chosen = question.choices[at];
      if (chosen !== undefined) {
        event.preventDefault();
        onChoose(chosen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, step, session.answers.length, onChoose, onMeet, onNext, onQuit]);
  if (question === undefined) return null;
  const card = cardOrPlaceholder(catalog, question.cardId, "common");
  const level = memory?.get(question.cardId)?.level ?? "blank";
  const total = session.questions.length;
  const last = session.index + 1 === total;
  const slip = step.name === "answered" && step.slip;
  const spelling =
    result?.correct && question.format === "typed" && step.name === "answered"
      ? spellingLine(step.chosen, card.word)
      : null;

  return (
    <section ref={quizRef} className={styles.quiz} aria-labelledby="prompt">
      <Desk className={styles.quizDesk} />
      <div className={styles.quizTop}>
        <RoundButton label="Arrêter le défi" onClick={onQuit}>
          <Icon name="close" size={20} />
        </RoundButton>
        <div className={styles.dots} aria-hidden="true">
          {session.questions.map((q, index) => {
            const answer = session.answers[index];
            const tone =
              answer !== undefined
                ? answer.correct
                  ? styles.right
                  : styles.wrong
                : index === session.index
                  ? styles.current
                  : styles.empty;
            // A missed word asked again comes back as a smaller dot.
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: one dot per question, in order
                key={index}
                className={`${styles.dot} ${tone} ${q.catchUp ? styles.catchUpDot : ""}`}
              />
            );
          })}
        </div>
        <span className={styles.position}>
          {session.index + 1}/{total}
          {result?.correct && result.progress.xpGained > 0 && (
            <span key={session.answers.length} className={styles.xpFloat} aria-hidden="true">
              +{result.progress.xpGained} XP
            </span>
          )}
        </span>
      </div>

      {step.name === "meeting" ? (
        <Meeting catalog={catalog} card={card} onMeet={onMeet} />
      ) : (
        <Asked
          catalog={catalog}
          session={session}
          question={question}
          card={card}
          level={level}
          result={result}
          spelling={spelling}
          slip={slip}
          last={last}
          error={error}
          noun={noun}
          onChoose={onChoose}
          onNext={onNext}
        />
      )}
    </section>
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
    const timer = window.setTimeout(word.play, SPEAK_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={`${ui.panel} ${styles.meeting}`}>
      <p className={ui.kicker}>{MEET_KICKER}</p>
      <div className={styles.meetingCard}>
        <Card card={card} collectionName={collectionName(catalog, card.collectionId)} width={240} />
      </div>
      <div className={styles.speech}>
        <SpeechButtons word={word} label={card.word} />
      </div>
      <Button onClick={onMeet}>{MEET_ACTION}</Button>
    </div>
  );
}

function Asked({
  catalog,
  session,
  question,
  card,
  level,
  result,
  spelling,
  slip,
  last,
  error,
  noun,
  onChoose,
  onNext,
}: {
  readonly catalog: Catalog;
  readonly session: Session;
  readonly question: SeriesQuestion;
  readonly card: CatalogCard;
  readonly level: AnsweredQuestion["level"];
  readonly result: AnsweredQuestion | null;
  readonly spelling: string | null;
  readonly slip: boolean;
  readonly last: boolean;
  readonly error: string | null;
  readonly noun: ReturnType<typeof usePackShape>["noun"];
  readonly onChoose: (cardId: string) => void;
  readonly onNext: () => void;
}) {
  const step = session.step;
  const { openCard } = useShell();
  // The choices are definitions when the word is shown or heard.
  const asksDefinition = question.format === "definition" || question.format === "listen";
  const pairs = question.format === "pairs";
  const mistakes = pairs && step.name === "answered" ? Number(step.chosen) : 0;
  const answerText = asksDefinition ? card.definition : card.word;
  return (
    <>
      <div className={`${ui.panel} ${styles.prompt}`}>
        <p className={ui.kicker}>{questionKicker(question.format)}</p>
        {question.format === "definition" ? (
          <SpokenPrompt key={question.cardId} card={card} />
        ) : question.format === "listen" ? (
          <HeardPrompt key={question.cardId} card={card} shown={result !== null} />
        ) : pairs ? null : (
          <h2 id="prompt" className={styles.promptDefinition}>
            {result === null ? hideWordIn(card.definition, card.word) : card.definition}
          </h2>
        )}
        {question.format === "typed" && result === null && (
          <p className={styles.promptHint}>
            {question.counted ? typedQuestionHint(level) : PRACTICE_TYPED_HINT}
          </p>
        )}
        {result === null && !pairs && (question.catchUp || !question.counted) && (
          <p className={styles.promptHint}>
            {question.catchUp ? CATCH_UP_HINT : PRACTICE_FREE_HINT}
          </p>
        )}
      </div>

      {question.format === "typed" ? (
        <TypedAnswer
          key={question.cardId}
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
        <ul className={styles.choices}>
          {question.choices.map((choiceId) => {
            const choice = cardOrPlaceholder(catalog, choiceId, "common");
            const state = choiceState(choiceId, question.cardId, session.step);
            return (
              <li key={choiceId}>
                <button
                  type="button"
                  className={`${styles.choice} ${styles[state] ?? ""} ${asksDefinition ? styles.choiceDefinition : `${ui.display} ${styles.choiceWord}`}`}
                  disabled={session.step.name !== "asking"}
                  data-right={state === "right" || undefined}
                  onClick={() => onChoose(choiceId)}
                >
                  {asksDefinition ? choice.definition : choice.word}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div aria-live="polite">
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {result !== null && (
          <div className={`${styles.feedback} ${result.correct ? styles.good : styles.bad}`}>
            {/* Every pair is found in the end: a round with mistakes is not a failure. */}
            <ToyBody
              matter={result.correct ? "green" : pairs ? "gold" : "red"}
              shape="round"
              className={styles.verdict}
            >
              <Icon name={result.correct || pairs ? "check" : "close"} size={24} />
            </ToyBody>
            {/* After a mistake, the card itself: the player sees again the thing they own. */}
            {!result.correct && !pairs && (
              <button
                type="button"
                className={styles.missedCard}
                aria-label={`Voir la carte ${card.word}`}
                onClick={() => openCard(card.id)}
              >
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={72}
                />
              </button>
            )}
            <div>
              <p className={styles.feedbackTitle}>
                {pairs && !result.correct
                  ? pairsVerdict(mistakes)
                  : answerTitle(result.correct, result.progress.xpGained, slip)}
              </p>
              {(!pairs || result.correct) && (
                <p className={styles.feedbackText}>
                  {pairs
                    ? pairsVerdict(mistakes)
                    : result.correct
                      ? (spelling ?? frequencyLine(card.perBillion))
                      : `La bonne réponse était « ${answerText} »`}
                </p>
              )}
              {result.levelUp && (
                <p className={`${styles.feedbackExtra} ${styles.risen}`}>
                  {levelUpLine(card.word, result.level)}
                </p>
              )}
              {[levelUpLabel(result.progress), ...bonusLines(result.bonus, noun)].map(
                (line) =>
                  line !== null && (
                    <p key={line} className={styles.feedbackExtra}>
                      {line}
                    </p>
                  ),
              )}
            </div>
            <Button onClick={onNext}>{last ? "Voir le résultat" : "Question suivante"}</Button>
          </div>
        )}
      </div>
      {!pairs && (
        <div className={styles.keys}>
          <Shortcuts list={"choices" in question ? CHOICE_SHORTCUTS : TYPED_SHORTCUTS} />
        </div>
      )}
    </>
  );
}

/** The keys of a challenge, behind a small keyboard: never in the way of the question. */
function Shortcuts({ list }: { readonly list: readonly KeyShortcut[] }) {
  return (
    <HelpTip label={KEYBOARD_HELP} title={KEYBOARD_HELP} icon="clavier" side="above" tone="felt">
      <span className={styles.shortcuts}>
        {list.map((shortcut) => (
          <span key={shortcut.action} className={styles.shortcut}>
            <span className={styles.keycaps}>
              {shortcut.keys.map((key) => (
                <kbd key={key} className={styles.keycap}>
                  {key}
                </kbd>
              ))}
            </span>
            {shortcut.action}
          </span>
        ))}
      </span>
    </HelpTip>
  );
}

/** A word to recognise by ear: said as it comes, written only once answered. */
function HeardPrompt({ card, shown }: { readonly card: CatalogCard; readonly shown: boolean }) {
  const word = useSpokenWord(card);
  // biome-ignore lint/correctness/useExhaustiveDependencies: said once, as the question comes
  useEffect(() => {
    const timer = window.setTimeout(word.play, SPEAK_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <h2 id="prompt" className={`${ui.display} ${styles.promptWord}`}>
        {shown ? card.word : <span className={styles.spoken}>Le mot est dit à voix haute.</span>}
      </h2>
      <div className={styles.heard}>
        <Toy matter="gold" shape="round" className={styles.heardButton} onClick={word.play}>
          <Icon name="sound" size={34} />
          <span className={styles.spoken}>Réécouter le mot</span>
        </Toy>
      </div>
    </>
  );
}

/** Four words and their definitions: a word, then its definition, until every pair is found. */
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
      play("answerWrong");
      vibrate([30]);
    } else if (next.matched.length > state.matched.length) {
      play("answerRight");
    }
    if (pairsDone(next, cards)) onDone(next.mistakes);
  };
  const tone = (side: PairSide, cardId: string) => {
    if (state.matched.includes(cardId)) return styles.right;
    if (state.picked?.side === side && state.picked.cardId === cardId) return styles.pending;
    const wrong = side === "word" ? state.wrong?.word : state.wrong?.definition;
    return wrong === cardId ? styles.wrong : "";
  };
  return (
    <div className={styles.pairs}>
      {(["word", "definition"] as const).map((side) => (
        <ul key={side} className={styles.pairColumn}>
          {(side === "word" ? cards : definitions).map((cardId) => {
            const card = cardOrPlaceholder(catalog, cardId, "common");
            return (
              <li key={cardId} className={styles.pairItem}>
                <button
                  type="button"
                  className={`${styles.choice} ${side === "word" ? `${ui.display} ${styles.choiceWord}` : styles.choiceDefinition} ${tone(side, cardId)}`}
                  aria-pressed={state.picked?.cardId === cardId && state.picked.side === side}
                  disabled={done || state.matched.includes(cardId)}
                  onClick={() => pick(side, cardId)}
                >
                  {side === "word" ? card.word : hideWordIn(card.definition, card.word)}
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

/** The word asked, said by the catalogue's voice as the question comes, unless it is muted. */
function SpokenPrompt({ card }: { readonly card: CatalogCard }) {
  const word = useSpokenWord(card);
  // Each question is a fresh component (keyed by its card): the word is said once, as it comes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per question on purpose
  useEffect(() => {
    if (!speechOn()) return;
    const timer = window.setTimeout(word.play, SPEAK_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <h2 id="prompt" className={`${ui.display} ${styles.promptWord}`}>
        {card.word}
      </h2>
      <div className={styles.speech}>
        <SpeechButtons word={word} label={card.word} />
      </div>
    </>
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
  const state = correct === null ? "" : correct ? styles.typedRight : styles.typedWrong;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim() !== "") onAnswer(typed);
  };
  return (
    <form className={styles.typed} onSubmit={submit}>
      <input
        data-right={correct === true || undefined}
        className={`${ui.field} ${ui.display} ${styles.typedField} ${state}`}
        value={step.name === "answered" ? step.chosen : typed}
        maxLength={TYPED_ANSWER_MAX_LENGTH}
        aria-label="Le mot"
        placeholder="Le mot"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // biome-ignore lint/a11y/noAutofocus: the field is the whole question
        autoFocus
        disabled={!asking}
        onChange={(event) => setTyped(event.target.value)}
      />
      {asking && (
        <div className={styles.typedActions}>
          <Button type="submit" disabled={typed.trim() === ""}>
            Valider le mot
          </Button>
          <Button type="button" variant="ghost" onClick={() => onAnswer("")}>
            Je sèche
          </Button>
        </div>
      )}
    </form>
  );
}

/** Counts from 0 up to `target` over `ms`, at once when the system asks for less motion. */
function useCountUp(target: number, ms: number): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const share = Math.min(1, (time - start) / ms);
      setShown(Math.round(target * share));
      if (share < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}

function Recap({
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
  const { noun } = usePackShape();
  const { openCard } = useShell();
  const tally = useShared(dailyChallenge);
  const clan = useShared(myClan);
  const summary = useShared(reviewSummary);
  const xp = sessionXpLine(answers);
  const clanShare = clan?.clanId == null ? null : clanShareLine(clanAnswers(answers));
  // The Jouer screen's clan row counts these answers too; the review counts what is left.
  useEffect(() => {
    refreshIfRead(myClan);
    reviewSummary.refresh();
  }, []);
  const bonus = sessionBonusLine(answers, noun);
  const scored = scoredAnswers(series, answers);
  const right = useCountUp(scored.filter((answer) => answer.correct).length, 500);
  useEffect(() => {
    play("recap");
    if (bonus === null) return;
    const timer = window.setTimeout(() => play("chimePrecious"), RECAP_BONUS_MS);
    return () => window.clearTimeout(timer);
  }, [bonus]);
  const climbed = climbedWords(answers);
  const back = comingBackTomorrow(answers);
  const backLine = comingBackLine(back.length);
  const actions = recapActions(summary, summary?.settings.length ?? answers.length, noun);
  const streak = summary === null ? null : streakLine(summary.streak);
  const card = (cardId: string) => cardOrPlaceholder(catalog, cardId, "common");
  return (
    <section className={`${ui.panel} ${styles.recap}`} aria-labelledby="recap-title">
      <p id="recap-title" className={ui.kicker}>
        Révision terminée
      </p>
      {/* Screen readers get the final score, not the count on its way. */}
      <p className={`${ui.display} ${styles.score}`}>
        <span aria-hidden="true">
          {right}/{scored.length}
        </span>
        <span className={styles.spoken}>{sessionScore(scored)}</span>
      </p>
      {xp !== null && <p className={styles.xp}>{xp}</p>}
      {streak !== null && <p className={styles.streak}>{streak}</p>}
      {bonus !== null ? (
        <p className={styles.won} style={{ animationDelay: `${RECAP_BONUS_MS}ms` }}>
          <Icon name="sachet" size={28} />
          {bonus}
        </p>
      ) : (
        tally !== null &&
        !tally.awarded && (
          <p className={styles.lost}>
            <em>{NOT_THIS_TIME}</em>
          </p>
        )
      )}
      {climbed.length > 0 && (
        <ul className={styles.recapCards} aria-label="Les mots qui montent">
          {climbed.map(({ cardId, level }) => (
            <li key={cardId} className={styles.recapCard}>
              <button
                type="button"
                className={styles.thumb}
                onClick={() => openCard(cardId)}
                aria-label={`Voir la carte ${card(cardId).word}`}
              >
                <Card
                  card={card(cardId)}
                  collectionName={collectionName(catalog, card(cardId).collectionId)}
                  width={92}
                />
              </button>
              <span className={styles.up}>{levelUpLine(card(cardId).word, level)}</span>
            </li>
          ))}
        </ul>
      )}
      {backLine !== null && (
        <>
          <p className={styles.comingBack}>{backLine}</p>
          <ul className={styles.recapCards} aria-label="Les mots à revoir demain">
            {back.map((cardId) => (
              <li key={cardId} className={styles.recapCard}>
                <button
                  type="button"
                  className={styles.thumb}
                  onClick={() => openCard(cardId)}
                  aria-label={`Voir la carte ${card(cardId).word}`}
                >
                  <Card
                    card={card(cardId)}
                    collectionName={collectionName(catalog, card(cardId).collectionId)}
                    width={72}
                  />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {clanShare !== null && (
        <p className={styles.clanShare}>
          <Icon name="clan" size={18} />
          {clanShare}
        </p>
      )}
      <div className={styles.recapActions}>
        {actions.moreFirst ? (
          <>
            <Button disabled={busy} onClick={onMore}>
              {actions.more}
            </Button>
            <ButtonLink variant="secondary" href="/jouer">
              {actions.open}
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href="/jouer">{actions.open}</ButtonLink>
            <Button variant="secondary" disabled={busy} onClick={onMore}>
              {actions.more}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onBack}>
          Retour aux défis
        </Button>
      </div>
    </section>
  );
}

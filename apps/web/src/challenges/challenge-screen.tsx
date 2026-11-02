"use client";

import type { MasteryLevelCode, PracticeScope } from "@leximon/contract";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import { createSeededRandom, TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import { effects } from "@leximon/tokens";
import {
  AFTER_ANSWER_MS,
  type AnsweredQuestion,
  answerFeedback,
  answerTitle,
  bonusLines,
  challengeOutlook,
  clanAnswers,
  clanShareLine,
  dailyView,
  escapingWords,
  freeAnswerOutcome,
  frequencyLine,
  hideWordIn,
  levelShares,
  levelUpLabel,
  levelUpLine,
  memoryCounts,
  memoryNote,
  NOT_THIS_TIME,
  noChallengeNotice,
  outlookLine,
  PRACTICE_FREE_HINT,
  PRACTICE_REFUSED,
  questionKicker,
  RECAP_BONUS_MS,
  reviewQuestion,
  type SessionQuestion,
  sessionBonusLine,
  sessionScore,
  sessionXpLine,
  spellingLine,
  typedQuestionHint,
} from "@leximon/view-model";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { api } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { usePackShape } from "@/lib/use-pack-shape";
import { Desk } from "@/library/play-pieces";
import { myClan } from "@/player/clan";
import { dailyChallenge, ownedCards, refreshIfRead, wordMemory } from "@/player/collection";
import { useShared } from "@/player/resource";
import { publishProgress } from "@/progress/use-progress";
import { RiddleEntry } from "@/riddle/riddle-entry";
import { useShell } from "@/shell/shell-context";
import { useLibraryLook } from "@/theme/use-library-look";
import { Button, ButtonLink, RoundButton } from "@/ui/button";
import { Icon, type IconName } from "@/ui/icon";
import { Bone } from "@/ui/skeleton";
import { ParticleStage, useOptionalStage } from "@/ui/stage";
import ui from "@/ui/ui.module.css";
import styles from "./challenge-screen.module.css";
import { takeAlbumPractice } from "./pending-practice";
import { PracticeSection } from "./practice-section";

/** `chosen`: the card picked, or the word typed. */
type Step =
  | { readonly name: "asking" }
  | { readonly name: "sending"; readonly chosen: string }
  | { readonly name: "answered"; readonly chosen: string; readonly slip: boolean }
  | { readonly name: "recap" };

interface Session {
  readonly questions: readonly SessionQuestion[];
  readonly answers: readonly AnsweredQuestion[];
  readonly index: number;
  readonly step: Step;
  /** A series on a scope the player picked, not the daily challenge. */
  readonly practice?: boolean;
}

/**
 * Défis: the daily goal, the player's memory, the words slipping away, and the sessions of
 * questions: multiple choice to keep words in memory, the word to type to raise its level.
 */
/** The challenges: today's, the memory by level, the words slipping away, and the questions. */
export function ChallengeScreen() {
  const library = useLibraryLook();
  return library ? (
    <ParticleStage>
      <ChallengeFlow />
    </ParticleStage>
  ) : (
    <ChallengeFlow />
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

  const loadIt = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError("Les cartes n'ont pas pu être chargées. Réessaie."));
  }, []);
  useEffect(loadIt, [loadIt]);

  // A word slipping away, picked in the list: a session of that one word.
  useEffect(() => {
    if (word === null || catalog === null || memory === null) return;
    router.replace(pathname, { scroll: false });
    const seed = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const question = reviewQuestion(
      createSeededRandom(seed),
      word,
      catalog.collections,
      memory.get(word),
      Date.now(),
    );
    if (question !== null) {
      setNotice(null);
      setSession({ questions: [question], answers: [], index: 0, step: { name: "asking" } });
    }
  }, [word, catalog, memory, router, pathname]);

  const practise = useCallback(async (scope: PracticeScope) => {
    setStarting(true);
    setNotice(null);
    setError(null);
    try {
      const series = await api.startPractice(scope);
      if (series.kind === "refused" || series.questions.length === 0) {
        setNotice(PRACTICE_REFUSED);
      } else {
        setSession({
          questions: series.questions,
          answers: [],
          index: 0,
          step: { name: "asking" },
          practice: true,
        });
      }
    } catch {
      setError("Le serveur ne répond pas. Réessaie.");
    } finally {
      setStarting(false);
    }
  }, []);

  // A filter of the album, reviewed from there.
  useEffect(() => {
    if (!fromAlbum || catalog === null) return;
    router.replace(pathname, { scroll: false });
    const cardIds = takeAlbumPractice();
    if (cardIds !== null) void practise({ kind: "cards", cardIds: [...cardIds] });
  }, [fromAlbum, catalog, router, pathname, practise]);

  const start = async () => {
    setStarting(true);
    setNotice(null);
    setError(null);
    try {
      const next = await api.fetchChallenges();
      if (next.questions.length === 0) {
        setNotice(noChallengeNotice(next.nextDueAt, Date.now(), noun));
      } else {
        setSession({ questions: next.questions, answers: [], index: 0, step: { name: "asking" } });
      }
    } catch {
      setError("Le serveur ne répond pas. Réessaie.");
    } finally {
      setStarting(false);
    }
  };

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
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setError(null);
    setSession({ ...session, step: { name: "sending", chosen } });
    try {
      const result = await sendAnswer(question, chosen, key);
      setPendingKey(null);
      refreshIfRead(wordMemory);
      dailyChallenge.refresh();
      if (result.kind === "not_due") {
        advance({ ...session, step: { name: "asking" } });
        return;
      }
      publishProgress(result.progress);
      const feel = answerFeedback(result);
      play(feel.cue);
      vibrate(feel.vibration);
      const { followUp } = feel;
      if (followUp !== null) window.setTimeout(() => play(followUp), AFTER_ANSWER_MS);
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

  const advance = (current: Session) => {
    setSession(
      current.index + 1 < current.questions.length
        ? { ...current, index: current.index + 1, step: { name: "asking" } }
        : { ...current, step: { name: "recap" } },
    );
  };

  const quit = () => {
    setSession(null);
    setError(null);
  };

  if (session !== null && catalog !== null) {
    return (
      <main className={styles.page}>
        {session.step.name === "recap" ? (
          <Recap
            catalog={catalog}
            answers={session.answers}
            practice={session.practice === true}
            onBack={quit}
          />
        ) : (
          <QuestionView
            catalog={catalog}
            session={session}
            error={error}
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
      <h1 className={`${ui.display} ${styles.title}`}>Défis</h1>
      <div className={styles.columns}>
        <DailyCard starting={starting} now={now} onStart={() => void start()} />
        <MemoryPanel now={now} />
      </div>
      {notice !== null && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <RiddleEntry now={now} />
      {catalog !== null && <Escaping catalog={catalog} now={now} />}
      {catalog !== null && (
        <PracticeSection
          catalog={catalog}
          now={now}
          busy={starting}
          onPick={(scope) => void practise(scope)}
        />
      )}
    </main>
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
  const { noun } = usePackShape();
  const view = tally === null ? null : dailyView(tally, noun);
  const outlook =
    owned === null || memory === null || now === 0
      ? null
      : outlookLine(challengeOutlook(memory, owned.keys(), now));
  return (
    <section className={`${ui.panel} ${styles.daily}`} aria-labelledby="daily-title">
      <div className={styles.dailyHead}>
        <div>
          <p className={`${ui.kicker} ${styles.dailyKicker}`}>Défi du jour</p>
          <h2 id="daily-title" className={`${ui.display} ${styles.dailyTitle}`}>
            {view === null ? <Bone className={styles.titleBone} /> : view.title}
          </h2>
          <p className={styles.dailyText}>
            {view === null ? (
              <>
                <Bone className={styles.lineBone} />
                <Bone className={`${styles.lineBone} ${styles.shortLine}`} />
              </>
            ) : (
              view.text
            )}
          </p>
        </div>
        <span className={styles.dailyIcon} aria-hidden="true">
          <Icon name="sachet" size={30} />
        </span>
      </div>
      <div className={styles.dailyBars} aria-hidden="true">
        {(view?.bars ?? ["empty", "empty", "empty", "empty", "empty"]).map((bar, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions of the goal
          <span key={index} className={`${styles.bar} ${styles[bar]}`} />
        ))}
      </div>
      {outlook !== null && <p className={styles.outlook}>{outlook}</p>}
      {view?.done ? (
        <Button variant="secondary" disabled={starting} onClick={onStart}>
          Réviser encore
        </Button>
      ) : (
        <Button disabled={starting || view === null} onClick={onStart}>
          {view?.action ?? "Commencer le défi"}
        </Button>
      )}
    </section>
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
    <section className={`${ui.panel} ${styles.memory}`} aria-labelledby="memory-title">
      <p id="memory-title" className={ui.kicker}>
        Tes mots par palier
      </p>
      <ul className={styles.levels}>
        {LEVELS.map(({ level, label, icon }) => (
          <li key={level} className={styles.level}>
            <span className={`${styles.levelIcon} ${styles[level]}`} aria-hidden="true">
              <Icon name={icon} size={20} />
            </span>
            <span className={`${ui.display} ${styles.levelCount}`}>
              {owned === null ? "–" : counts[level]}
            </span>
            <span className={styles.levelLabel}>{label}</span>
          </li>
        ))}
      </ul>
      {owned !== null && owned.size > 0 && (
        <div className={styles.shares} aria-hidden="true">
          {LEVELS.map(({ level }) => (
            <span
              key={level}
              className={`${styles.share} ${styles[level]}`}
              style={{ flexGrow: shares[level] }}
            />
          ))}
        </div>
      )}
      <p className={styles.memoryNote}>{memoryNote(now)}</p>
    </section>
  );
}

/** Words slipping away: due now, or within the day. */
function Escaping({ catalog, now }: { readonly catalog: Catalog; readonly now: number }) {
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const { openCard } = useShell();
  if (owned === null || memory === null) return null;
  const words = escapingWords(memory, new Set(owned.keys()), now);
  if (words.length === 0) return null;
  return (
    <section aria-labelledby="escaping-title">
      <h2 id="escaping-title" className={`${ui.display} ${styles.subtitle}`}>
        Mots à réviser
      </h2>
      <ul className={styles.escaping}>
        {words.map((entry) => {
          const card = cardOrPlaceholder(catalog, entry.cardId, "common");
          return (
            <li key={entry.cardId} className={`${ui.panel} ${styles.slipping}`}>
              <button
                type="button"
                className={styles.thumb}
                onClick={() => openCard(card.id)}
                aria-label={`Voir la carte ${card.word}`}
              >
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={60}
                />
              </button>
              <div className={styles.slippingText}>
                <p className={styles.slippingWord}>{card.word}</p>
                <p className={styles.slippingWhen}>{entry.when}</p>
                {entry.rise !== null && <p className={styles.slippingRise}>{entry.rise}</p>}
              </div>
              {entry.due && (
                <ButtonLink variant="ghost" small href={`/defis?mot=${card.id}`}>
                  Réviser
                </ButtonLink>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type ChoiceState = "idle" | "pending" | "right" | "wrong" | "faded";

function choiceState(choiceId: string, answerId: string, step: Step): ChoiceState {
  if (step.name === "asking" || step.name === "recap") return "idle";
  if (step.name === "sending") return choiceId === step.chosen ? "pending" : "idle";
  if (choiceId === answerId) return "right";
  return choiceId === step.chosen ? "wrong" : "faded";
}

function QuestionView({
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
  if (question === undefined) return null;
  const card = cardOrPlaceholder(catalog, question.cardId, "common");
  const asksDefinition = question.format === "definition";
  const level = memory?.get(question.cardId)?.level ?? "sketch";
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
            return <span key={q.cardId} className={`${styles.dot} ${tone}`} />;
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

      <div className={`${ui.panel} ${styles.prompt}`}>
        <p className={ui.kicker}>{questionKicker(question.format)}</p>
        {asksDefinition ? (
          <h2 id="prompt" className={`${ui.display} ${styles.promptWord}`}>
            {card.word}
          </h2>
        ) : (
          <h2 id="prompt" className={styles.promptDefinition}>
            {result === null ? hideWordIn(card.definition, card.word) : card.definition}
          </h2>
        )}
        {question.format === "typed" && result === null && (
          <p className={styles.promptHint}>{typedQuestionHint(level)}</p>
        )}
        {question.counted === false && result === null && (
          <p className={styles.promptHint}>{PRACTICE_FREE_HINT}</p>
        )}
      </div>

      {question.format === "typed" ? (
        <TypedAnswer
          key={question.cardId}
          step={step}
          correct={result?.correct ?? null}
          onAnswer={onChoose}
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
                  className={`${styles.choice} ${styles[state]} ${asksDefinition ? styles.choiceDefinition : `${ui.display} ${styles.choiceWord}`}`}
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
            <div>
              <p className={styles.feedbackTitle}>
                {answerTitle(result.correct, result.progress.xpGained, slip)}
              </p>
              <p className={styles.feedbackText}>
                {result.correct
                  ? (spelling ?? frequencyLine(card.perBillion))
                  : `La bonne réponse était « ${asksDefinition ? card.definition : card.word} »`}
              </p>
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
    </section>
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
  practice,
  onBack,
}: {
  readonly catalog: Catalog;
  readonly answers: readonly AnsweredQuestion[];
  readonly practice: boolean;
  readonly onBack: () => void;
}) {
  const { noun } = usePackShape();
  const tally = useShared(dailyChallenge);
  const clan = useShared(myClan);
  const xp = sessionXpLine(answers);
  const clanShare = clan?.clanId == null ? null : clanShareLine(clanAnswers(answers));
  // The Jouer screen's clan row counts these answers too.
  useEffect(() => refreshIfRead(myClan), []);
  const bonus = sessionBonusLine(answers, noun);
  const right = useCountUp(answers.filter((answer) => answer.correct).length, 500);
  useEffect(() => {
    play("recap");
    if (bonus === null) return;
    const timer = window.setTimeout(() => play("chimePrecious"), RECAP_BONUS_MS);
    return () => window.clearTimeout(timer);
  }, [bonus]);
  const ups = answers
    .filter((answer) => answer.levelUp)
    .map((answer) =>
      levelUpLine(cardOrPlaceholder(catalog, answer.cardId, "common").word, answer.level),
    );
  return (
    <section className={`${ui.panel} ${styles.recap}`} aria-labelledby="recap-title">
      <p id="recap-title" className={ui.kicker}>
        {practice ? "Entraînement terminé" : "Défi terminé"}
      </p>
      {/* Screen readers get the final score, not the count on its way. */}
      <p className={`${ui.display} ${styles.score}`}>
        <span aria-hidden="true">
          {right}/{answers.length}
        </span>
        <span className={styles.spoken}>{sessionScore(answers)}</span>
      </p>
      {xp !== null && <p className={styles.xp}>{xp}</p>}
      {clanShare !== null && (
        <p className={styles.clanShare}>
          <Icon name="clan" size={18} />
          {clanShare}
        </p>
      )}
      {bonus !== null ? (
        <p className={styles.won} style={{ animationDelay: `${RECAP_BONUS_MS}ms` }}>
          <Icon name="sachet" size={28} />
          {bonus}
        </p>
      ) : (
        !practice &&
        tally !== null &&
        !tally.awarded && (
          <p className={styles.lost}>
            <em>{NOT_THIS_TIME}</em>
          </p>
        )
      )}
      {ups.map((line) => (
        <p key={line} className={styles.up}>
          {line}
        </p>
      ))}
      <div className={styles.recapActions}>
        <Button onClick={onBack}>Retour aux défis</Button>
        <ButtonLink variant="secondary" href="/jouer">
          Ouvrir un {noun.one}
        </ButtonLink>
      </div>
    </section>
  );
}

"use client";

import type { ChallengeQuestion, MasteryLevelCode } from "@leximon/contract";
import { createSeededRandom } from "@leximon/core";
import {
  type AnsweredQuestion,
  answerTitle,
  bonusLines,
  dailyView,
  escapingWords,
  frequencyLine,
  levelUpLabel,
  levelUpLine,
  memoryCounts,
  memoryNote,
  NOT_THIS_TIME,
  nextDueLabel,
  questionKicker,
  reviewQuestion,
  sessionBonusLine,
  sessionScore,
  sessionXpLine,
} from "@leximon/view-model";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type Catalog, cardOrPlaceholder, collectionName, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { answerChallenge, fetchChallenges } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { usePackShape } from "@/lib/use-pack-shape";
import { dailyChallenge, ownedCards, refreshIfRead, wordMemory } from "@/player/collection";
import { useShared } from "@/player/resource";
import { publishProgress } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { Button, ButtonLink, RoundButton } from "@/ui/button";
import { Icon, type IconName } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./challenge-screen.module.css";

type Step =
  | { readonly name: "asking" }
  | { readonly name: "sending"; readonly chosen: string }
  | { readonly name: "answered"; readonly chosen: string }
  | { readonly name: "recap" };

interface Session {
  readonly questions: readonly ChallengeQuestion[];
  readonly answers: readonly AnsweredQuestion[];
  readonly index: number;
  readonly step: Step;
}

/**
 * Défis: the daily goal, the player's memory, the words slipping away, and
 * the sessions of multiple-choice questions that raise the words' level.
 */
export function ChallengeScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never counts an answer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { noun } = usePackShape();
  const now = useNow(60_000);
  const word = useSearchParams().get("mot");
  const router = useRouter();
  const pathname = usePathname();

  const loadIt = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError("Le catalogue ne répond pas."));
  }, []);
  useEffect(loadIt, [loadIt]);

  // « Réviser ce mot » (card sheet, words slipping away): a session of that one word.
  useEffect(() => {
    if (word === null || catalog === null) return;
    router.replace(pathname, { scroll: false });
    const seed = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const question = reviewQuestion(createSeededRandom(seed), word, catalog.collections);
    if (question !== null) {
      setNotice(null);
      setSession({ questions: [question], answers: [], index: 0, step: { name: "asking" } });
    }
  }, [word, catalog, router, pathname]);

  const start = async () => {
    setStarting(true);
    setNotice(null);
    setError(null);
    try {
      const next = await fetchChallenges();
      if (next.questions.length === 0) {
        const when = nextDueLabel(next.nextDueAt, Date.now());
        setNotice(
          next.nextDueAt === null
            ? `Rien à réviser. Ouvre des ${noun.many} : chaque mot trouvé devient un défi.`
            : `Tes mots tiennent bon. Le prochain revient ${when ?? "bientôt"}.`,
        );
      } else {
        setSession({ questions: next.questions, answers: [], index: 0, step: { name: "asking" } });
      }
    } catch {
      setError("Le serveur lambine. Réessaie.");
    } finally {
      setStarting(false);
    }
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
      const result = await answerChallenge(
        { cardId: question.cardId, format: question.format, chosenCardId: chosen },
        key,
      );
      setPendingKey(null);
      refreshIfRead(wordMemory);
      dailyChallenge.refresh();
      if (result.kind === "not_due") {
        advance({ ...session, step: { name: "asking" } });
        return;
      }
      publishProgress(result.progress);
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
          },
        ],
        step: { name: "answered", chosen },
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
          <Recap catalog={catalog} answers={session.answers} onBack={quit} />
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
        <DailyCard starting={starting} onStart={() => void start()} />
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
      {catalog !== null && <Escaping catalog={catalog} now={now} />}
    </main>
  );
}

function DailyCard({
  starting,
  onStart,
}: {
  readonly starting: boolean;
  readonly onStart: () => void;
}) {
  const tally = useShared(dailyChallenge);
  const { noun } = usePackShape();
  const view = tally === null ? null : dailyView(tally, noun);
  return (
    <section className={`${ui.panel} ${styles.daily}`} aria-labelledby="daily-title">
      <div className={styles.dailyHead}>
        <div>
          <p className={`${ui.kicker} ${styles.dailyKicker}`}>Défi du jour</p>
          <h2 id="daily-title" className={`${ui.display} ${styles.dailyTitle}`}>
            {view?.title ?? "Défi du jour"}
          </h2>
          <p className={styles.dailyText}>{view?.text ?? " "}</p>
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
  return (
    <section className={`${ui.panel} ${styles.memory}`} aria-labelledby="memory-title">
      <p id="memory-title" className={ui.kicker}>
        Ta mémoire
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
        Ces mots t'échappent
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
  const question = session.questions[session.index];
  if (question === undefined) return null;
  const card = cardOrPlaceholder(catalog, question.cardId, "common");
  const asksDefinition = question.format === "definition";
  const total = session.questions.length;
  const last = session.index + 1 === total;
  const result = session.step.name === "answered" ? (session.answers.at(-1) ?? null) : null;

  return (
    <section className={styles.quiz} aria-labelledby="prompt">
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
            {card.definition}
          </h2>
        )}
      </div>

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
                onClick={() => onChoose(choiceId)}
              >
                {asksDefinition ? choice.definition : choice.word}
              </button>
            </li>
          );
        })}
      </ul>

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
                {answerTitle(result.correct, result.progress.xpGained)}
              </p>
              <p className={styles.feedbackText}>
                {result.correct
                  ? frequencyLine(card.perBillion)
                  : `C'était : ${asksDefinition ? card.definition : card.word}`}
              </p>
              {[
                result.levelUp ? levelUpLine(card.word, result.level) : null,
                levelUpLabel(result.progress),
                ...bonusLines(result.bonus, noun),
              ].map(
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

function Recap({
  catalog,
  answers,
  onBack,
}: {
  readonly catalog: Catalog;
  readonly answers: readonly AnsweredQuestion[];
  readonly onBack: () => void;
}) {
  const { noun } = usePackShape();
  const tally = useShared(dailyChallenge);
  const xp = sessionXpLine(answers);
  const bonus = sessionBonusLine(answers, noun);
  const ups = answers
    .filter((answer) => answer.levelUp)
    .map((answer) =>
      levelUpLine(cardOrPlaceholder(catalog, answer.cardId, "common").word, answer.level),
    );
  return (
    <section className={`${ui.panel} ${styles.recap}`} aria-labelledby="recap-title">
      <p id="recap-title" className={ui.kicker}>
        Défi terminé
      </p>
      <p className={`${ui.display} ${styles.score}`}>{sessionScore(answers)}</p>
      {xp !== null && <p className={styles.xp}>{xp}</p>}
      {bonus !== null ? (
        <p className={styles.won}>
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

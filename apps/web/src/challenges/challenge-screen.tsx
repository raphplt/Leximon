"use client";

import type { CatalogCard, ChallengeQuestion } from "@leximon/contract";
import { cssFill, rarityStyles } from "@leximon/tokens";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { type Catalog, cardOrPlaceholder, loadCatalog } from "@/cards/catalog";
import { usePageView } from "@/lib/analytics";
import { answerChallenge, fetchChallenges } from "@/lib/api";
import { usePackShape } from "@/lib/experiments";
import { useNow } from "@/lib/use-now";
import styles from "./challenge-screen.module.css";
import {
  type AnsweredQuestion,
  bonusLines,
  feedbackLine,
  levelUpLine,
  nextDueLabel,
  recapLine,
  sessionBonusLine,
} from "./session";

type Phase =
  | { readonly name: "loading" }
  | { readonly name: "unavailable" }
  | { readonly name: "empty"; readonly nextDueAt: string | null }
  | { readonly name: "asking"; readonly index: number }
  | { readonly name: "sending"; readonly index: number; readonly chosen: string }
  | { readonly name: "answered"; readonly index: number; readonly chosen: string }
  | { readonly name: "recap" };

/**
 * A challenge session (D-025): the server picks the words due for review, the player answers one
 * multiple-choice question per word, and the right answers raise the card's level.
 */
export function ChallengeScreen() {
  const { noun } = usePackShape();
  usePageView("challenges");
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [questions, setQuestions] = useState<readonly ChallengeQuestion[]>([]);
  const [answers, setAnswers] = useState<readonly AnsweredQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never counts an answer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase({ name: "loading" });
    try {
      const [loadedCatalog, session] = await Promise.all([loadCatalog(), fetchChallenges()]);
      setCatalog(loadedCatalog);
      setQuestions(session.questions);
      setAnswers([]);
      setPhase(
        session.questions.length > 0
          ? { name: "asking", index: 0 }
          : { name: "empty", nextDueAt: session.nextDueAt },
      );
    } catch {
      setPhase({ name: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (index: number, chosen: string) => {
    const question = questions[index];
    if (question === undefined) return;
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setError(null);
    setPhase({ name: "sending", index, chosen });
    try {
      const result = await answerChallenge(
        { cardId: question.cardId, format: question.format, chosenCardId: chosen },
        key,
      );
      setPendingKey(null);
      if (result.kind === "not_due") {
        advance(index);
        return;
      }
      setAnswers((previous) => [
        ...previous,
        {
          cardId: question.cardId,
          correct: result.correct,
          levelUp: result.levelUp,
          level: result.level,
          bonus: result.bonus,
        },
      ]);
      setPhase({ name: "answered", index, chosen });
    } catch {
      setError("Ta réponse n'est pas partie. Vérifie ta connexion et réessaie.");
      setPhase({ name: "asking", index });
    }
  };

  const advance = (index: number) => {
    setPhase(
      index + 1 < questions.length ? { name: "asking", index: index + 1 } : { name: "recap" },
    );
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Défis</p>
        <h1 className={styles.title}>Fais monter tes cartes</h1>
      </header>

      {phase.name === "loading" && <p className={styles.hint}>Un instant…</p>}

      {phase.name === "unavailable" && (
        <div className={styles.center}>
          <p className={styles.hint}>Impossible de joindre le serveur.</p>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      )}

      {phase.name === "empty" && <Empty nextDueAt={phase.nextDueAt} />}

      {(phase.name === "asking" || phase.name === "sending" || phase.name === "answered") &&
        catalog !== null && (
          <QuestionView
            key={phase.index}
            catalog={catalog}
            question={questions[phase.index]}
            position={phase.index + 1}
            total={questions.length}
            chosen={phase.name === "asking" ? null : phase.chosen}
            result={phase.name === "answered" ? (answers.at(-1) ?? null) : null}
            error={error}
            onChoose={(cardId) => void choose(phase.index, cardId)}
            onNext={() => advance(phase.index)}
          />
        )}

      {phase.name === "recap" && (
        <div className={styles.center}>
          <h2 className={styles.recapTitle}>Défi terminé</h2>
          <p className={styles.hint}>{recapLine(answers)}</p>
          {sessionBonusLine(answers, noun) !== null && (
            <p className={styles.bonusRecap}>{sessionBonusLine(answers, noun)}</p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void load()}>
              Continuer
            </button>
            <Link href="/album" className={styles.secondary}>
              Voir mon album
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Empty({ nextDueAt }: { readonly nextDueAt: string | null }) {
  const now = useNow(60_000);
  const { noun } = usePackShape();
  const when = nextDueLabel(nextDueAt, now);
  return (
    <div className={styles.center}>
      {nextDueAt === null ? (
        <>
          <p className={styles.hint}>Ouvre des {noun.many} : chaque mot gagné devient un défi.</p>
          <Link href="/" className={styles.primary}>
            Ouvrir un {noun.one}
          </Link>
        </>
      ) : (
        <>
          <p className={styles.hint}>
            Tu as révisé tous tes mots. Le prochain revient {when ?? "bientôt"}.
          </p>
          <Link href="/" className={styles.secondary}>
            Ouvrir un {noun.one} en attendant
          </Link>
        </>
      )}
    </div>
  );
}

function QuestionView({
  catalog,
  question,
  position,
  total,
  chosen,
  result,
  error,
  onChoose,
  onNext,
}: {
  readonly catalog: Catalog;
  readonly question: ChallengeQuestion | undefined;
  readonly position: number;
  readonly total: number;
  readonly chosen: string | null;
  readonly result: AnsweredQuestion | null;
  readonly error: string | null;
  readonly onChoose: (cardId: string) => void;
  readonly onNext: () => void;
}) {
  const { noun } = usePackShape();
  if (question === undefined) return null;
  const card = cardOrPlaceholder(catalog, question.cardId, "common");
  const asksDefinition = question.format === "definition";

  return (
    <section className={styles.question} style={QUESTION_COLORS} aria-labelledby="prompt">
      <p className={styles.position}>
        {position} / {total}
      </p>
      <div className={styles.prompt}>
        <p className={styles.instruction}>
          {asksDefinition ? "Que veut dire ce mot ?" : "Quel mot correspond à cette définition ?"}
        </p>
        {asksDefinition ? (
          <h2 id="prompt" className={styles.word}>
            {card.word}
            <span className={styles.chip}>{card.partOfSpeech}</span>
          </h2>
        ) : (
          <h2 id="prompt" className={styles.definitionPrompt}>
            {card.definition}
          </h2>
        )}
      </div>

      <ul className={styles.choices}>
        {question.choices.map((choiceId) => (
          <li key={choiceId}>
            <Choice
              card={cardOrPlaceholder(catalog, choiceId, "common")}
              showDefinition={asksDefinition}
              state={choiceState(choiceId, question.cardId, chosen, result !== null)}
              disabled={chosen !== null}
              onChoose={() => onChoose(choiceId)}
            />
          </li>
        ))}
      </ul>

      <div className={styles.feedback} aria-live="polite">
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {result !== null && (
          <>
            <p className={result.correct ? styles.right : styles.wrong}>
              {feedbackLine(result.correct)}
            </p>
            {result.levelUp && (
              <p className={styles.levelUp}>{levelUpLine(card.word, result.level)}</p>
            )}
            {bonusLines(result.bonus, noun).map((line) => (
              <p key={line} className={styles.bonus}>
                {line}
              </p>
            ))}
            <button type="button" className={styles.next} onClick={onNext}>
              {position === total ? "Voir le bilan" : "Suivante"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// Choices are printed on card paper; right and wrong borrow the Peu courant and Rare colours.
const QUESTION_COLORS = {
  "--paper": rarityStyles.common.paper,
  "--ink": rarityStyles.common.ink,
  "--muted": rarityStyles.common.muted,
  "--right": cssFill(rarityStyles.uncommon.frame),
  "--wrong": cssFill(rarityStyles.rare.frame),
} as CSSProperties;

type ChoiceState = "idle" | "pending" | "right" | "wrong" | "missed";

function choiceState(
  choiceId: string,
  answerId: string,
  chosen: string | null,
  revealed: boolean,
): ChoiceState {
  if (chosen === null) return "idle";
  if (!revealed) return choiceId === chosen ? "pending" : "idle";
  if (choiceId === answerId) return choiceId === chosen ? "right" : "missed";
  return choiceId === chosen ? "wrong" : "idle";
}

function Choice({
  card,
  showDefinition,
  state,
  disabled,
  onChoose,
}: {
  readonly card: CatalogCard;
  readonly showDefinition: boolean;
  readonly state: ChoiceState;
  readonly disabled: boolean;
  readonly onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${styles[state]}`}
      disabled={disabled}
      onClick={onChoose}
    >
      {showDefinition ? (
        <span className={styles.choiceDefinition}>{card.definition}</span>
      ) : (
        <span className={styles.choiceWord}>{card.word}</span>
      )}
    </button>
  );
}

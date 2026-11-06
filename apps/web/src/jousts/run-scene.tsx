"use client";

import type { AnswerJoustResponse } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { cssFill, rarityStyles, revealEffects, toyMatters } from "@leximon/tokens";
import { secondsLeft } from "@leximon/view-model";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { play, vibrate } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { RarityIcon } from "@/components/rarity-icon";
import desk from "@/play/desk-columns.module.css";
import { catalogCard } from "@/trades/card-thumb";
import { Icon } from "@/ui/icon";
import { useStage } from "@/ui/stage";
import { Lettering, Toy } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./jousts.module.css";
import { type Duelist, DuelistFace, rise } from "./pieces";

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

/** The answers of a lane: right, wrong, or answered before the page came (`null`). */
type LaneAnswer = boolean | null;

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
}: {
  readonly source: RunSource;
  readonly me: Duelist;
  readonly them: Duelist;
  /** The other player's recorded run, when they played first. */
  readonly ghost: readonly { readonly correct: boolean }[] | null;
  readonly questions: number;
  /** Questions answered before the page came. */
  readonly answered: number;
  readonly kicker: string;
  readonly doneLabel: string;
  readonly onDone: () => void;
}) {
  const stage = useStage();
  const catalog = useCatalog();
  const [phase, setPhase] = useState<Phase>({ kind: "versus", count: 0 });
  const [results, setResults] = useState<readonly LaneAnswer[]>(() =>
    Array.from({ length: answered }, () => null),
  );
  const [flying, setFlying] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<number[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const retry = useRef<() => void>(() => undefined);

  const later = useCallback((ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

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
        play("flip");
      } catch (failure) {
        retry.current = () => void fetchNext(after);
        setError(failure instanceof Error ? failure.message : "Le serveur ne répond pas.");
      }
    },
    [source, clear, later],
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

  const skipVersus = useCallback(() => {
    if (phase.kind === "versus") void fetchNext(null);
  }, [phase.kind, fetchNext]);

  // The face-to-face, then 3, 2, 1: the server's clock starts only with the first question.
  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once, when the scene appears
  useEffect(() => {
    COUNTDOWN.forEach((_, index) => {
      later(900 + index * COUNT_MS, () => {
        setPhase({ kind: "versus", count: index + 1 });
        play("cardSlide");
      });
    });
    later(900 + COUNTDOWN.length * COUNT_MS, () => void fetchNext(null));
  }, []);

  // The clock, a frame every tenth of a second while a question is on.
  useEffect(() => {
    if (phase.kind !== "question") return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
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
    if (card.current !== null) stage.shake(card.current, 6, 320);
    play("answerWrong");
    settle(phase.question, null, { correct: false, rightCardId: "", late: true, runOver: false });
  }, [now, phase, source.graceMs, settle, stage]);

  const answer = async (question: RunQuestion, cardId: string, button: HTMLElement) => {
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
      const box = button.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      stage.ring(x, y, toyMatters.green.top, 1.6);
      for (const burst of revealEffects.uncommon.bursts) {
        stage.burst(x, y, {
          ...burst,
          colors: [toyMatters.gold.top, toyMatters.green.top, toyMatters.paper.top],
        });
      }
      setFlying((count) => count + 1);
      play("answerRight");
      vibrate([18]);
    } else {
      if (card.current !== null) stage.shake(card.current, 6, 320);
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
    <section className={`${ui.leaf} ${styles.joust} ${desk.rising}`} style={rise(0)}>
      <header className={styles.joustHead}>
        <span className={desk.leafKicker}>{kicker}</span>
      </header>

      <Lanes me={me.name} them={them.name} mine={results} theirs={ghostSoFar} total={questions} />

      {phase.kind === "versus" && (
        // A touch skips the face-to-face.
        <button type="button" className={styles.versusStage} onClick={skipVersus}>
          <span className={styles.versusSide} data-side="left">
            <DuelistFace duelist={me} size={96} />
            <Lettering className={styles.versusName}>{me.name}</Lettering>
          </span>
          <span className={styles.versusMiddle}>
            {phase.count === 0 ? (
              <Lettering className={styles.versusWord}>contre</Lettering>
            ) : (
              <Lettering key={phase.count} className={styles.countdown}>
                {COUNTDOWN[phase.count - 1]}
              </Lettering>
            )}
          </span>
          <span className={styles.versusSide} data-side="right">
            <DuelistFace duelist={them} size={96} />
            <Lettering className={styles.versusName}>{them.name}</Lettering>
          </span>
        </button>
      )}

      {phase.kind === "loading" && <div className={styles.questionWait} aria-busy="true" />}

      {shown !== null && (
        <div className={styles.questionStage}>
          <div className={styles.questionTop}>
            <span className={styles.counter}>
              {shown.question.position + 1} / {questions}
            </span>
            <Ring
              key={shown.question.position}
              question={shown.question}
              running={shown.kind === "question"}
              left={left ?? 0}
            />
          </div>
          <Definition
            key={`card-${shown.question.position}`}
            refTo={card}
            rarity={rarityOf(shown.question.choices)}
            text={shown.question.definition}
          />
          <div className={styles.choices}>
            {shown.question.choices.map((cardId) => {
              const answered = shown.kind === "answered" ? shown : null;
              const isRight = answered !== null && cardId === answered.answer.rightCardId;
              const chosen = answered !== null && answered.chosen === cardId;
              const word = wordOf(cardId);
              return (
                <Toy
                  key={cardId}
                  matter={isRight ? "green" : chosen ? "red" : "paper"}
                  className={styles.choice}
                  data-dim={(answered !== null && !isRight && !chosen) || undefined}
                  disabled={shown.kind !== "question" || shown.sending}
                  onClick={(event) => {
                    if (shown.kind === "question" && !shown.sending) {
                      void answer(shown.question, cardId, event.currentTarget);
                    }
                  }}
                >
                  {isRight || chosen ? <Lettering>{word}</Lettering> : word}
                </Toy>
              );
            })}
          </div>
          {shown.kind === "answered" && shown.answer.late && (
            <p className={styles.lateLine} role="status">
              Le temps est écoulé : la question compte fausse.
            </p>
          )}
          {flying > 0 && (
            <Lettering key={flying} className={styles.plusOne}>
              +1
            </Lettering>
          )}
        </div>
      )}

      {phase.kind === "done" && (
        <div className={styles.doneStage}>
          <span className={styles.stamp}>Partie jouée</span>
          <Toy matter="gold" className={styles.control} onClick={onDone}>
            {doneLabel}
          </Toy>
        </div>
      )}

      {error !== null && (
        <div className={styles.runError} role="alert">
          <p className={styles.notice}>{error}</p>
          <Toy matter="paper" className={styles.control} onClick={() => retry.current()}>
            Réessayer
          </Toy>
        </div>
      )}
    </section>
  );
}

function Definition({
  refTo,
  rarity,
  text,
}: {
  readonly refTo: RefObject<HTMLDivElement | null>;
  readonly rarity: Rarity | null;
  readonly text: string;
}) {
  return (
    <div
      ref={refTo}
      className={styles.definition}
      style={
        rarity === null
          ? undefined
          : ({ "--band": cssFill(rarityStyles[rarity].band) } as CSSProperties)
      }
    >
      <span className={styles.definitionBand}>
        {rarity !== null && <RarityIcon rarity={rarity} size="14px" />}
      </span>
      <p>{text}</p>
    </div>
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
  const lane = (name: string, answers: readonly LaneAnswer[], side: "me" | "them") => (
    <div className={styles.lane} data-side={side}>
      <span className={styles.laneName}>{name}</span>
      <span className={styles.lanePips}>
        {Array.from({ length: total }, (_, index) => {
          const answer = answers[index];
          const state =
            answer === undefined
              ? undefined
              : answer === null
                ? "played"
                : answer
                  ? "right"
                  : "wrong";
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: one pip per question, in order
            <span key={index} className={styles.pip} data-state={state}>
              {typeof answer === "boolean" && <Icon name={answer ? "check" : "close"} size={12} />}
            </span>
          );
        })}
      </span>
      <Lettering className={styles.laneScore}>{answers.filter((a) => a === true).length}</Lettering>
    </div>
  );
  return (
    <div className={styles.lanes}>
      {lane(me, mine, "me")}
      {lane(them, theirs, "them")}
    </div>
  );
}

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
  // Set once, when the question comes: a page reloaded mid-question starts the ring where it was.
  const [elapsed] = useState(() =>
    Math.min(question.totalMs, Math.max(0, question.totalMs - (question.deadline - Date.now()))),
  );
  // Once answered, the figure stays where the clock stopped.
  const shown = useRef(left);
  if (running) shown.current = left;
  return (
    <span
      className={styles.ring}
      data-running={running || undefined}
      data-hot={shown.current <= HOT_SECONDS || undefined}
      style={
        {
          "--total": `${question.totalMs}ms`,
          "--delay": `${-elapsed}ms`,
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className={styles.ringTrack} cx="22" cy="22" r="18" />
        <circle className={styles.ringFill} cx="22" cy="22" r="18" />
      </svg>
      <Lettering className={styles.ringFigure}>{shown.current}</Lettering>
    </span>
  );
}

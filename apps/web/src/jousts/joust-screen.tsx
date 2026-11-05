"use client";

import type { AnswerJoustResponse, JoustAnswer, JoustView } from "@leximon/contract";
import { ApiError, type Catalog } from "@leximon/contract/client";
import {
  clockShare,
  firstRunDone,
  forfeitLine,
  ghostLine,
  ghostTitle,
  joustAnswerFeedback,
  launchRefusalText,
  localDeadline,
  outcomeTitle,
  PLAY_JOUST,
  playerName,
  questionCounter,
  REVENGE,
  rewardText,
  runRules,
  runSize,
  scoresLine,
  secondsLeft,
  trappedLine,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { api } from "@/lib/api";
import { publishProgress } from "@/progress/use-progress";
import { catalogCard } from "@/trades/card-thumb";
import { Button } from "@/ui/button";
import { LoadFailed } from "@/ui/load-failed";
import ui from "@/ui/ui.module.css";
import styles from "./jousts.module.css";

/** After the clock, the server still takes an answer this long: the next question waits for it. */
const AFTER_CLOCK_MS = 2_500;
/** How long the answer stays shown before the next question. */
const FEEDBACK_MS = 1_200;

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "missing" }
  | { readonly state: "ready"; readonly view: JoustView };

interface Served {
  readonly position: number;
  readonly definition: string;
  readonly choices: readonly string[];
  readonly deadline: number;
  readonly totalMs: number;
}

type Run =
  | { readonly phase: "intro" }
  | { readonly phase: "question"; readonly question: Served; readonly sending: boolean }
  | {
      readonly phase: "answered";
      readonly question: Served;
      readonly chosen: string | null;
      readonly answer: AnswerJoustResponse;
      /** The clock as it stood at the answer. */
      readonly at: number;
    };

/** One joust: the player's run on the clock, then the wait or the result. */
export function JoustScreen({ joustId }: { readonly joustId: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  const load = useCallback(() => {
    api
      .fetchJoust(joustId)
      .then((view) => setLoaded({ state: "ready", view }))
      .catch((error: unknown) =>
        setLoaded(
          error instanceof ApiError && error.status === 404
            ? { state: "missing" }
            : { state: "failed" },
        ),
      );
  }, [joustId]);
  useEffect(load, [load]);

  return (
    <main className={styles.page}>
      <Link href="/joutes" className={styles.back}>
        Retour aux joutes
      </Link>
      {loaded.state === "failed" && <LoadFailed onRetry={load} />}
      {loaded.state === "missing" && (
        <p className={styles.line}>Cette joute n'existe pas, ou elle n'est pas la tienne.</p>
      )}
      {loaded.state === "ready" &&
        (loaded.view.summary.state === "play" ? (
          <RunScreen view={loaded.view} joustId={joustId} onOver={load} />
        ) : loaded.view.result !== null ? (
          <Result view={loaded.view} />
        ) : (
          <section className={`${ui.panel} ${styles.panel}`}>
            <h1 className={`${ui.display} ${styles.headline}`}>
              Joute contre {playerName(loaded.view.summary.opponent)}
            </h1>
            <p className={styles.line}>
              {firstRunDone(loaded.view.summary.opponent, loaded.view.summary.replyBy, Date.now())}
            </p>
          </section>
        ))}
    </main>
  );
}

function RunScreen({
  view,
  joustId,
  onOver,
}: {
  readonly view: JoustView;
  readonly joustId: string;
  readonly onOver: () => void;
}) {
  const catalog = useCatalog();
  const [run, setRun] = useState<Run>({ phase: "intro" });
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    api
      .fetchProgress()
      .then(publishProgress)
      .catch(() => undefined);
    onOver();
  }, [onOver]);

  const next = useCallback(
    async (after: number | null) => {
      setError(null);
      try {
        const result = await api.nextJoustQuestion(joustId);
        if (result.kind === "run_over") {
          finish();
          return;
        }
        if (result.kind === "refused") {
          setError("Cette joute attend encore la partie de ton adversaire.");
          return;
        }
        // The server keeps a question on until its allowance is over: ask again a little later.
        if (after !== null && result.position <= after) {
          retry.current = setTimeout(() => void next(after), 1_000);
          return;
        }
        const receivedAt = Date.now();
        setNow(receivedAt);
        setRun({
          phase: "question",
          sending: false,
          question: {
            position: result.position,
            definition: result.definition,
            choices: result.choices,
            deadline: localDeadline(result, receivedAt),
            totalMs: Date.parse(result.deadline) - Date.parse(result.servedAt),
          },
        });
      } catch {
        setError("Le serveur ne répond pas. Réessaie.");
      }
    },
    [joustId, finish],
  );

  useEffect(() => () => clearTimeout(retry.current ?? undefined), []);

  // The clock: a frame every tenth of a second while a question is on.
  useEffect(() => {
    if (run.phase !== "question") return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [run.phase]);

  // Out of time: the question counts wrong, the next one comes once the server lets it go.
  useEffect(() => {
    if (run.phase !== "question" || run.sending) return;
    if (now < run.question.deadline + AFTER_CLOCK_MS) return;
    const position = run.question.position;
    setRun({
      phase: "answered",
      question: run.question,
      chosen: null,
      answer: { correct: false, rightCardId: "", late: true, runOver: false },
      at: run.question.deadline,
    });
    play("answerWrong");
    retry.current = setTimeout(() => void next(position), FEEDBACK_MS);
  }, [now, run, next]);

  const answer = async (question: Served, cardId: string) => {
    const at = Date.now();
    setRun({ phase: "question", question, sending: true });
    try {
      const result = await api.answerJoust(joustId, question.position, cardId);
      if (result.kind === "refused") {
        setError("Cette réponse n'a pas été prise. Recharge la page.");
        return;
      }
      setRun({ phase: "answered", question, chosen: cardId, answer: result, at });
      if (result.correct) {
        setMine((count) => count + 1);
        play("answerRight");
        vibrate([12]);
      } else {
        play("answerWrong");
        vibrate([10, 60, 10]);
      }
      retry.current = setTimeout(
        () => (result.runOver ? finish() : void next(question.position)),
        FEEDBACK_MS,
      );
    } catch {
      setRun({ phase: "question", question, sending: false });
      setError("Le serveur ne répond pas. Réessaie.");
    }
  };

  const { summary, ghost } = view;
  if (run.phase === "intro") {
    return (
      <section className={`${ui.panel} ${styles.panel}`}>
        <h1 className={`${ui.display} ${styles.headline}`}>
          Joute contre {playerName(summary.opponent)}
        </h1>
        {ghost !== null && <p className={styles.line}>{ghostTitle(summary.opponent)}</p>}
        <p className={styles.line}>{runRules(Date.now())}</p>
        {error !== null && (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        )}
        <Button glow wide disabled={catalog === null} onClick={() => void next(null)}>
          {view.answered > 0 ? "Reprendre la joute" : PLAY_JOUST}
        </Button>
      </section>
    );
  }

  const { question } = run;
  const clockAt = run.phase === "answered" ? run.at : now;
  const left = secondsLeft(question.deadline, clockAt);
  const share = clockShare(question.deadline, question.totalMs, clockAt);
  return (
    <section className={`${ui.panel} ${styles.panel} ${styles.run}`}>
      <div className={styles.runHead}>
        <p className={ui.kicker}>{questionCounter(question.position, runSize(now).questions)}</p>
        <p className={styles.seconds}>
          {left} <abbr title="secondes">s</abbr>
        </p>
      </div>
      <div className={styles.clock} aria-hidden="true">
        <span
          className={`${styles.clockFill} ${share < 0.3 ? styles.clockLow : ""}`}
          style={{ transform: `scaleX(${share})` }}
        />
      </div>
      {ghost !== null && (
        <p className={styles.ghost}>
          {ghostLine(ghost, question.position, summary.opponent)} Tu en as {mine}.
        </p>
      )}
      <p className={`${ui.display} ${styles.definition}`}>{question.definition}</p>
      <div className={styles.choices}>
        {question.choices.map((cardId) => (
          <ChoiceButton
            key={cardId}
            catalog={catalog}
            cardId={cardId}
            run={run}
            onPick={() => {
              if (run.phase === "question" && !run.sending) void answer(question, cardId);
            }}
          />
        ))}
      </div>
      {run.phase === "answered" && (
        <p
          className={run.answer.correct ? styles.right : styles.wrong}
          role="status"
          aria-live="polite"
        >
          {joustAnswerFeedback(run.answer)}
        </p>
      )}
      {error !== null && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ChoiceButton({
  catalog,
  cardId,
  run,
  onPick,
}: {
  readonly catalog: Catalog | null;
  readonly cardId: string;
  readonly run: Run;
  readonly onPick: () => void;
}) {
  const word = catalog === null ? "…" : catalogCard(catalog, cardId).word;
  const answered = run.phase === "answered" ? run : null;
  const state =
    answered === null
      ? ""
      : cardId === answered.answer.rightCardId
        ? styles.choiceRight
        : cardId === answered.chosen
          ? styles.choiceWrong
          : styles.choiceDim;
  return (
    <button
      type="button"
      className={`${styles.choice} ${state}`}
      disabled={run.phase !== "question" || run.sending}
      onClick={onPick}
    >
      {word}
    </button>
  );
}

function Result({ view }: { readonly view: JoustView }) {
  const router = useRouter();
  const catalog = useCatalog();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const { summary, result } = view;
  if (result === null) return null;
  const name = playerName(summary.opponent);
  const reward = rewardText(result);

  const revenge = async () => {
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    setBusy(true);
    setRefusal(null);
    try {
      const launched = await api.launchJoust({ kind: "revenge", joustId: summary.id }, key);
      pendingKey.current = null;
      if (launched.kind === "launched") router.push(`/joutes/${launched.joustId}`);
      else setRefusal(launchRefusalText(launched.reason, 0));
    } catch {
      setRefusal("Le serveur ne répond pas. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const wordOf = (cardId: string) => (catalog === null ? "…" : catalogCard(catalog, cardId).word);
  const trapped = summary.forfeit
    ? null
    : trappedLine(
        result.theirs.filter((answer) => !answer.correct).map((answer) => wordOf(answer.cardId)),
        summary.opponent,
      );
  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-live="polite">
      <h1 className={`${ui.display} ${styles.headline}`}>{outcomeTitle(summary)}</h1>
      {summary.forfeit ? (
        <p className={styles.line}>{forfeitLine(summary.launched, summary.opponent)}</p>
      ) : (
        summary.mine !== null &&
        summary.theirs !== null && (
          <p className={styles.line}>
            {scoresLine(summary.mine, summary.theirs, result.mine.length, summary.opponent)}
          </p>
        )
      )}
      {reward !== null && <p className={styles.reward}>{reward}</p>}
      {trapped !== null && <p className={styles.line}>{trapped}</p>}
      <div className={styles.runs}>
        <RunList title="Tes réponses" answers={result.mine} wordOf={wordOf} />
        {!summary.forfeit && (
          <RunList title={`Les réponses de ${name}`} answers={result.theirs} wordOf={wordOf} />
        )}
      </div>
      {refusal !== null && (
        <p className={styles.notice} role="alert">
          {refusal}
        </p>
      )}
      <Button disabled={busy} onClick={() => void revenge()}>
        {REVENGE}
      </Button>
    </section>
  );
}

function RunList({
  title,
  answers,
  wordOf,
}: {
  readonly title: string;
  readonly answers: readonly JoustAnswer[];
  readonly wordOf: (cardId: string) => string;
}) {
  return (
    <div>
      <h2 className={ui.kicker}>{title}</h2>
      <ol className={styles.answers}>
        {answers.map((answer) => (
          <li key={answer.cardId} className={answer.correct ? styles.right : styles.wrong}>
            <Link href={`/carte/${answer.cardId}`}>{wordOf(answer.cardId)}</Link>
            <span>
              {answer.correct ? "trouvé" : "raté"} en {Math.round(answer.ms / 1000)} s
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

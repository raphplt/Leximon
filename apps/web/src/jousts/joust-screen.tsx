"use client";

import type { JoustView, PlayerBadge, ProfileResponse } from "@leximon/contract";
import { ApiError } from "@leximon/contract/client";
import {
  forfeitLine,
  joustLine,
  localDeadline,
  NEW_JOUST,
  playerName,
  REVENGE_SHORT,
  runSize,
  trappedLine,
  trappingWords,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { api } from "@/lib/api";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { refreshIfRead } from "@/player/collection";
import { missions, profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { publishProgress, useProgress } from "@/progress/use-progress";
import { catalogCard } from "@/trades/card-thumb";
import { LoadFailed } from "@/ui/load-failed";
import { ParticleStage } from "@/ui/stage";
import styles from "./jousts.module.css";
import type { Duelist } from "./pieces";
import { Reveal, type RevealData, SealedResult } from "./reveal";
import { RunScene, type RunSource } from "./run-scene";
import { RunSummary } from "./run-summary";
import { useLaunch } from "./use-launch";

/** After the clock, the server still takes an answer this long: the next question waits for it. */
const AFTER_CLOCK_MS = 2_500;
const NO_ANSWER = "Le serveur ne répond pas. Réessaie.";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "missing" }
  | { readonly state: "ready"; readonly view: JoustView };

/** One joust: the player's run on the clock, then the summary while the other plays, then the result. */
export function JoustScreen({ joustId }: { readonly joustId: string }) {
  return (
    <ParticleStage>
      <JoustFlow joustId={joustId} />
    </ParticleStage>
  );
}

function JoustFlow({ joustId }: { readonly joustId: string }) {
  const router = useRouter();
  const catalog = useCatalog();
  const progress = useProgress();
  const me = useShared(profile);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  // The result plays at once, unsealed, when it comes from the run just played or the seal broken.
  const [revealing, setRevealing] = useState(false);
  const { launch, busy, refusal } = useLaunch(0);

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

  const source = useMemo(() => apiSource(joustId), [joustId]);

  const runOver = useCallback(() => {
    api
      .fetchProgress()
      .then(publishProgress)
      .catch(() => undefined);
    refreshIfRead(missions);
    setRevealing(true);
    load();
  }, [load]);

  const view = loaded.state === "ready" ? loaded.view : null;
  const ended = view?.summary.state === "ended";
  // Watched once: the seal stays broken on every device.
  useEffect(() => {
    if (ended && revealing) api.markJoustSeen(joustId).catch(() => undefined);
  }, [ended, revealing, joustId]);

  if (loaded.state === "failed") {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={load} />
      </main>
    );
  }
  if (loaded.state === "missing") {
    return (
      <main className={styles.page}>
        <BackLink />
        <p className={styles.line}>Cette joute n'existe pas, ou elle n'est pas la tienne.</p>
      </main>
    );
  }
  if (view === null) return <main className={styles.page} />;

  const { summary } = view;
  const kicker = joustLine(summary, runSize(Date.now()).questions, Date.now()).title;
  const mine = duelistOf(me);
  const them = opponentOf(summary.opponent);
  const word = (cardId: string) => (catalog === null ? "…" : catalogCard(catalog, cardId).word);
  const goHome = () => router.push("/joutes");

  return (
    <main className={styles.page}>
      <BackLink />
      {summary.state === "play" && (
        <RunScene
          source={source}
          me={mine}
          them={them}
          ghost={view.ghost}
          questions={runSize(Date.now()).questions}
          answered={view.answered}
          kicker={kicker}
          doneLabel={summary.launched ? "Voir le bilan" : "Voir le résultat"}
          onDone={runOver}
        />
      )}
      {summary.state === "waiting" && (
        <RunSummary
          view={view}
          them={them}
          kicker={kicker}
          progress={progress}
          busy={busy}
          refusal={refusal}
          onNew={() => void launch({ kind: "ranked" })}
          onBack={goHome}
        />
      )}
      {ended && !summary.seen && !revealing && (
        <SealedResult kicker={kicker} onOpen={() => setRevealing(true)} />
      )}
      {ended && view.result !== null && (summary.seen || revealing) && (
        <Reveal data={revealOf(view, mine, them, word)} kicker={kicker} playing={revealing}>
          {refusal !== null && (
            <p className={styles.notice} role="alert">
              {refusal}
            </p>
          )}
          <MainAction
            label={REVENGE_SHORT}
            disabled={busy}
            onClick={() => void launch({ kind: "revenge", joustId: summary.id })}
          />
          <PaperAction label={NEW_JOUST} onClick={() => void launch({ kind: "ranked" })} />
        </Reveal>
      )}
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/joutes" className={styles.back}>
      Retour aux joutes
    </Link>
  );
}

function duelistOf(me: ProfileResponse | null): Duelist {
  return { name: me?.pseudo ?? "Toi", avatar: me?.avatar ?? null, frame: me?.frame ?? null };
}

function opponentOf(opponent: PlayerBadge | null): Duelist {
  return {
    name: playerName(opponent),
    avatar: opponent?.avatar ?? null,
    frame: opponent?.frame ?? null,
  };
}

function revealOf(
  view: JoustView,
  me: Duelist,
  them: Duelist,
  word: (cardId: string) => string,
): RevealData {
  const { summary, result } = view;
  const theirs = result === null || summary.forfeit ? null : result.theirs;
  return {
    me,
    them,
    mine: result?.mine ?? [],
    theirs,
    outcome: summary.outcome,
    gains:
      result === null
        ? null
        : { xp: result.xp, boosters: result.boosters, tournament: result.tournament },
    closing: summary.forfeit
      ? forfeitLine(summary.launched, summary.opponent)
      : trappedLine(trappingWords(theirs ?? [], word), summary.opponent),
  };
}

/** The run on the server's clock. */
function apiSource(joustId: string): RunSource {
  const call = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch {
      throw new Error(NO_ANSWER);
    }
  };
  return {
    graceMs: AFTER_CLOCK_MS,
    async next(after) {
      const result = await call(() => api.nextJoustQuestion(joustId));
      if (result.kind === "run_over") return { kind: "over" };
      if (result.kind === "refused") {
        throw new Error("Cette joute attend encore la partie de ton adversaire.");
      }
      // The server keeps a question on until its allowance is over.
      if (after !== null && result.position <= after) return { kind: "wait" };
      return {
        kind: "question",
        question: {
          position: result.position,
          definition: result.definition,
          choices: result.choices,
          deadline: localDeadline(result, Date.now()),
          totalMs: Date.parse(result.deadline) - Date.parse(result.servedAt),
        },
      };
    },
    async answer(question, cardId) {
      const result = await call(() => api.answerJoust(joustId, question.position, cardId));
      if (result.kind === "refused") {
        throw new Error("Cette réponse n'a pas été prise. Recharge la page.");
      }
      return {
        correct: result.correct,
        rightCardId: result.rightCardId,
        late: result.late,
        runOver: result.runOver,
      };
    },
  };
}

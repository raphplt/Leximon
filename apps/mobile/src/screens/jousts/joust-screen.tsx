import type { JoustView, PlayerBadge, ProfileResponse } from "@leximon/contract";
import { ApiError } from "@leximon/contract/client";
import {
  forfeitLine,
  JOUSTS_TITLE,
  joustLine,
  localDeadline,
  NEW_JOUST,
  playerName,
  REVENGE_SHORT,
  runSize,
  searchedFor,
  trappedLine,
  trappingWords,
  wishedLine,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { useCatalog } from "@/cards/use-catalog";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { refreshIfRead } from "@/player/collection";
import { useShared } from "@/player/shared";
import { missions, profile, progress, wallet } from "@/player/state";
import { catalogCard } from "@/screens/trades/card-row";
import { Button } from "@/ui/button";
import { Page, Paragraph } from "@/ui/page";
import { ParticleStage } from "@/ui/stage";
import { type Duelist, Notice } from "./pieces";
import { Reveal, type RevealData, SealedResult } from "./reveal";
import { RunScene, type RunSource } from "./run-scene";
import { RunSummary } from "./run-summary";
import { StartScene } from "./start-scene";
import { launchedHere, NO_ANSWER, useLaunch } from "./use-launch";

/** After the clock, the server still takes an answer this long: the next question waits for it. */
const AFTER_CLOCK_MS = 2_500;

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
  const catalog = useCatalog();
  const level = useShared(progress);
  const me = useShared(profile);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  // The result plays at once, unsealed, when it comes from the run just played or the seal broken.
  const [revealing, setRevealing] = useState(false);
  // « Commencer » was pressed on the face-to-face: the run follows without its own countdown.
  const [begun, setBegun] = useState(false);
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
    progress.refresh();
    refreshIfRead(wallet);
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

  if (view === null) {
    return (
      <Page title={JOUSTS_TITLE}>
        {loaded.state === "loading" && <Paragraph muted>Un instant…</Paragraph>}
        {loaded.state === "missing" && (
          <Paragraph muted>Cette joute n'existe pas, ou elle n'est pas la tienne.</Paragraph>
        )}
        {loaded.state === "failed" && (
          <>
            <Paragraph muted>La joute n'a pas pu être chargée. Réessaie.</Paragraph>
            <Button label="Réessayer" secondary onPress={load} />
          </>
        )}
      </Page>
    );
  }

  const { summary } = view;
  const size = runSize(Date.now());
  const kicker = joustLine(summary, size.questions, Date.now()).title;
  const mine = duelistOf(me);
  const them = opponentOf(summary.opponent);
  const word = (cardId: string) => (catalog === null ? "…" : catalogCard(catalog, cardId).word);
  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/joutes");
  };

  return (
    <Page title={JOUSTS_TITLE}>
      {summary.state === "play" && !view.started && !begun && (
        <StartScene
          view={view}
          me={mine}
          them={them}
          search={launchedHere(joustId) && searchedFor(summary.kind)}
          onStart={() => setBegun(true)}
          onLater={goHome}
        />
      )}
      {summary.state === "play" && (view.started || begun) && (
        <RunScene
          versus={!begun}
          source={source}
          me={mine}
          them={them}
          ghost={view.ghost}
          questions={size.questions}
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
          progress={level}
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
          <Notice>{refusal}</Notice>
          <MainAction
            label={REVENGE_SHORT}
            disabled={busy}
            onPress={() => void launch({ kind: "revenge", joustId: summary.id })}
          />
          <PaperAction label={NEW_JOUST} onPress={() => void launch({ kind: "ranked" })} />
        </Reveal>
      )}
    </Page>
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
      ? forfeitLine(summary)
      : trappedLine(trappingWords(theirs ?? [], word), summary.opponent),
    wished: wishedLine(result?.wished.length ?? 0),
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
        throw new Error("Cette réponse n'a pas été prise. Reviens à la joute pour la reprendre.");
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

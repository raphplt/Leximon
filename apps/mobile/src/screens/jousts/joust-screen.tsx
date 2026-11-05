import type { AnswerJoustResponse, JoustAnswer, JoustView } from "@leximon/contract";
import { ApiError, type Catalog } from "@leximon/contract/client";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  clockShare,
  firstRunDone,
  forfeitLine,
  ghostLine,
  ghostTitle,
  JOUSTS_TITLE,
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
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { useCatalog } from "@/cards/use-catalog";
import { play, vibrate } from "@/feedback/feedback";
import { refreshIfRead } from "@/player/collection";
import { progress, wallet } from "@/player/state";
import { catalogCard, openCard } from "@/screens/trades/card-row";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { FormError, Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Lettering, toyFace } from "@/ui/toy";

/** After the clock, the server still takes an answer this long: the next question waits for it. */
const AFTER_CLOCK_MS = 2_500;
/** How long the answer stays shown before the next question. */
const FEEDBACK_MS = 1_200;

const NO_ANSWER = "Le serveur ne répond pas. Réessaie.";

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
    <Page title={JOUSTS_TITLE}>
      {loaded.state === "loading" && <Paragraph muted>Un instant…</Paragraph>}
      {loaded.state === "failed" && (
        <>
          <Paragraph muted>La joute n'a pas pu être chargée. Réessaie.</Paragraph>
          <Button label="Réessayer" secondary onPress={load} />
        </>
      )}
      {loaded.state === "missing" && (
        <Paragraph muted>Cette joute n'existe pas, ou elle n'est pas la tienne.</Paragraph>
      )}
      {loaded.state === "ready" &&
        (loaded.view.summary.state === "play" ? (
          <RunScreen view={loaded.view} joustId={joustId} onOver={load} />
        ) : loaded.view.result !== null ? (
          <Result view={loaded.view} />
        ) : (
          <Panel paper style={styles.panel}>
            <Text style={styles.headline}>
              Joute contre {playerName(loaded.view.summary.opponent)}
            </Text>
            <Text style={styles.line}>
              {firstRunDone(loaded.view.summary.opponent, loaded.view.summary.replyBy, Date.now())}
            </Text>
          </Panel>
        ))}
    </Page>
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
    progress.refresh();
    refreshIfRead(wallet);
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
        setError(NO_ANSWER);
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
        setError("Cette réponse n'a pas été prise. Reviens à la joute pour la reprendre.");
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
      setError(NO_ANSWER);
    }
  };

  const { summary, ghost } = view;
  if (run.phase === "intro") {
    return (
      <Panel paper style={styles.panel}>
        <Text style={styles.headline}>Joute contre {playerName(summary.opponent)}</Text>
        {ghost !== null && <Text style={styles.line}>{ghostTitle(summary.opponent)}</Text>}
        <Text style={styles.line}>{runRules(Date.now())}</Text>
        <FormError message={error} />
        <Button
          label={view.answered > 0 ? "Reprendre la joute" : PLAY_JOUST}
          disabled={catalog === null}
          onPress={() => void next(null)}
        />
      </Panel>
    );
  }

  const { question } = run;
  const clockAt = run.phase === "answered" ? run.at : now;
  const left = secondsLeft(question.deadline, clockAt);
  const share = clockShare(question.deadline, question.totalMs, clockAt);
  return (
    <Panel paper style={styles.panel}>
      <View style={styles.runHead}>
        <Text style={styles.kicker}>
          {questionCounter(question.position, runSize(now).questions).toUpperCase()}
        </Text>
        <Text style={styles.seconds} accessibilityLabel={`${left} secondes`}>
          {left} s
        </Text>
      </View>
      <View style={styles.clock} importantForAccessibility="no" accessibilityElementsHidden>
        <View
          style={[
            styles.clockFill,
            share < 0.3 && styles.clockLow,
            { width: `${Math.round(share * 100)}%` },
          ]}
        />
      </View>
      {ghost !== null && (
        <Text style={styles.ghost}>
          {ghostLine(ghost, question.position, summary.opponent)} Tu en as {mine}.
        </Text>
      )}
      <Text style={styles.definition}>{question.definition}</Text>
      <View style={styles.choices}>
        {question.choices.map((cardId) => (
          <Choice
            key={cardId}
            catalog={catalog}
            cardId={cardId}
            run={run}
            onPick={() => {
              if (run.phase === "question" && !run.sending) void answer(question, cardId);
            }}
          />
        ))}
      </View>
      {run.phase === "answered" && (
        <Text
          style={run.answer.correct ? styles.right : styles.wrong}
          accessibilityLiveRegion="polite"
        >
          {joustAnswerFeedback(run.answer)}
        </Text>
      )}
      <FormError message={error} />
    </Panel>
  );
}

function Choice({
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
      ? "idle"
      : cardId === answered.answer.rightCardId
        ? "right"
        : cardId === answered.chosen
          ? "wrong"
          : "faded";
  const matter = state === "right" ? "green" : state === "wrong" ? "red" : "paper";
  const disabled = run.phase !== "question" || run.sending;
  return (
    <Pressable
      onPress={onPick}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.choice,
        toyFace(matter, "tile"),
        state === "faded" && styles.faded,
        pressed && styles.pressed,
      ]}
    >
      {state === "right" || state === "wrong" ? (
        <Lettering size={18}>{word}</Lettering>
      ) : (
        <Text style={styles.choiceWord}>{word}</Text>
      )}
    </Pressable>
  );
}

function Result({ view }: { readonly view: JoustView }) {
  const catalog = useCatalog();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const { summary, result } = view;
  if (result === null) return null;
  const name = playerName(summary.opponent);
  const reward = rewardText(result);

  const revenge = async () => {
    const key = pendingKey.current ?? randomUUID();
    pendingKey.current = key;
    setBusy(true);
    setRefusal(null);
    try {
      const launched = await api.launchJoust({ kind: "revenge", joustId: summary.id }, key);
      pendingKey.current = null;
      if (launched.kind === "launched") {
        router.replace({ pathname: "/joutes/[id]", params: { id: launched.joustId } });
      } else {
        setRefusal(launchRefusalText(launched.reason, 0));
      }
    } catch {
      setRefusal(NO_ANSWER);
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
    <Panel paper style={styles.panel}>
      <Text style={styles.headline} accessibilityLiveRegion="polite">
        {outcomeTitle(summary)}
      </Text>
      {summary.forfeit ? (
        <Text style={styles.line}>{forfeitLine(summary.launched, summary.opponent)}</Text>
      ) : (
        summary.mine !== null &&
        summary.theirs !== null && (
          <Text style={styles.line}>
            {scoresLine(summary.mine, summary.theirs, result.mine.length, summary.opponent)}
          </Text>
        )
      )}
      {reward !== null && <Text style={styles.reward}>{reward}</Text>}
      {trapped !== null && <Text style={styles.line}>{trapped}</Text>}
      <RunList title="TES RÉPONSES" answers={result.mine} wordOf={wordOf} />
      {!summary.forfeit && (
        <RunList
          title={`LES RÉPONSES DE ${name.toUpperCase()}`}
          answers={result.theirs}
          wordOf={wordOf}
        />
      )}
      <FormError message={refusal} />
      <Button label={REVENGE} disabled={busy} onPress={() => void revenge()} />
    </Panel>
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
  const cardIds = answers.map((answer) => answer.cardId);
  return (
    <View style={styles.answers}>
      <Text style={styles.kicker}>{title}</Text>
      {answers.map((answer) => (
        <Pressable
          key={answer.cardId}
          style={styles.answer}
          onPress={() => openCard(answer.cardId, cardIds)}
          accessibilityRole="link"
        >
          <Text style={[styles.answerWord, answer.correct ? styles.right : styles.wrong]}>
            {wordOf(answer.cardId)}
          </Text>
          <Text style={styles.answerTime}>
            {answer.correct ? "trouvé" : "raté"} en {Math.round(answer.ms / 1000)} s
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** What the panels hold is read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  panel: { gap: space.s6 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  line: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 32,
    color: ink.pageInk,
  },
  runHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seconds: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  clock: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: ink.track,
  },
  clockFill: { height: "100%", backgroundColor: toyMatters.gold.top },
  clockLow: { backgroundColor: toyMatters.red.top },
  ghost: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  definition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.subtitle,
    lineHeight: 26,
    color: ink.pageInk,
  },
  choices: { gap: space.s4 },
  choice: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.s6,
    borderWidth: toyValues.outlineWidth,
    marginBottom: 4,
  },
  choiceWord: { fontFamily: fonts.ui.bold, fontSize: fontSizes.lead, color: ink.pageInk },
  faded: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 3 }] },
  right: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.success },
  wrong: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.danger },
  reward: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
    padding: space.s4,
    borderRadius: radii.md,
    backgroundColor: alpha(colors.gilt, 0.18),
  },
  answers: { gap: space.s3 },
  answer: { flexDirection: "row", justifyContent: "space-between", gap: space.s4, minHeight: 32 },
  answerWord: { textDecorationLine: "underline" },
  answerTime: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, color: ink.pageInkMuted },
});

import type { ReviewRequest } from "@leximon/contract";
import type { Catalog } from "@leximon/contract/client";
import {
  AFTER_ANSWER_MS,
  answerFeedback,
  freeAnswerOutcome,
  noChallengeNotice,
  PACK_NOUNS,
  PRACTICE_REFUSED,
  playable,
  type SeriesQuestion,
  seriesOf,
  withCatchUp,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { play, speechOn, vibrate } from "@/feedback/feedback";
import { dailyChallenge, refreshIfRead, reviewSummary, wordMemory } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { publishProgress, wallet } from "@/player/state";
import { IS_LIBRARY } from "@/theme";
import { ParticleStage } from "@/ui/stage";
import { ChallengeRecap } from "./challenge-recap";
import { takeAlbumPractice } from "./pending-practice";
import { QuestionView } from "./question-view";
import { ReviewDesk } from "./review-desk";
import { advance, type Session, startSession } from "./session";

const NOUN = PACK_NOUNS.sachet;

/**
 * Défis: the review of the player's words, the shelf of scopes to practise on, the daily
 * challenge, the riddle and the memory by level; then the series of questions themselves.
 */
export function ChallengeScreen(props: {
  readonly word: string | null;
  readonly fromAlbum: boolean;
}) {
  return IS_LIBRARY ? (
    <ParticleStage>
      <ChallengeFlow {...props} />
    </ParticleStage>
  ) : (
    <ChallengeFlow {...props} />
  );
}

function ChallengeFlow({
  word,
  fromAlbum,
}: {
  readonly word: string | null;
  readonly fromAlbum: boolean;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never counts an answer twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const now = useNow(60_000);
  const memory = useShared(wordMemory);

  const loadIt = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setError("Les cartes n'ont pas pu être chargées. Réessaie."));
  }, []);
  useEffect(loadIt, [loadIt]);

  const start = useCallback(async (request: ReviewRequest) => {
    setStarting(true);
    setNotice(null);
    setError(null);
    try {
      const series = await api.startReview(request);
      if (series.kind === "refused") {
        setNotice(PRACTICE_REFUSED);
      } else if (series.questions.length === 0) {
        setNotice(noChallengeNotice(null, Date.now(), NOUN));
      } else {
        // Without sound, a word to listen to is shown instead.
        const questions = seriesOf(series.questions).map((q) => playable(q, speechOn()));
        setSession(startSession(questions, request));
      }
    } catch {
      setError("Le serveur ne répond pas. Réessaie.");
    } finally {
      setStarting(false);
    }
  }, []);

  // A word asked from elsewhere (the mail) opens the series; a filter of the album makes its scope.
  useEffect(() => {
    if (catalog === null) return;
    if (word !== null) {
      router.setParams({ mot: undefined });
      void start({ first: word });
    } else if (fromAlbum) {
      router.setParams({ revision: undefined });
      const cardIds = takeAlbumPractice();
      if (cardIds !== null) void start({ scope: { kind: "cards", cardIds: [...cardIds] } });
    }
  }, [word, fromAlbum, catalog, start]);

  /**
   * A word that counts goes through the review; free practice only earns its XP. `chosen` is the
   * card picked, the word spelled out, or the mistakes of a round of pairs.
   */
  const sendAnswer = async (question: SeriesQuestion, chosen: string, key: string) => {
    const { cardId } = question;
    if (question.counted && question.format !== "pairs") {
      return api.answerChallenge(
        question.format === "typed" || question.format === "letters"
          ? { cardId, format: question.format, typed: chosen }
          : { cardId, format: question.format, chosenCardId: chosen },
        key,
      );
    }
    const free = await api.answerPractice(
      question.format === "pairs"
        ? { cardId, format: "pairs", mistakes: Number(chosen) }
        : question.format === "typed" || question.format === "letters"
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
    const key = pendingKey ?? randomUUID();
    setPendingKey(key);
    setError(null);
    setSession({ ...session, step: { name: "sending", chosen } });
    try {
      const result = await sendAnswer(question, chosen, key);
      setPendingKey(null);
      refreshIfRead(wordMemory);
      dailyChallenge.refresh();
      if (result.kind === "not_due") {
        setSession(advance({ ...session, step: { name: "asking" } }));
        return;
      }
      publishProgress(result.progress);
      const feel = answerFeedback(result);
      play(feel.cue);
      vibrate(feel.vibration);
      const { followUp } = feel;
      if (followUp !== null) setTimeout(() => play(followUp), AFTER_ANSWER_MS);
      // A bonus sachet went to the reserve: the top bar's count follows.
      if (result.bonus.credited > 0) refreshIfRead(wallet);
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

  const quit = () => {
    setSession(null);
    setError(null);
    reviewSummary.refresh();
  };

  if (session !== null && catalog !== null) {
    return session.step.name === "recap" ? (
      <ChallengeRecap
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
        onNext={() => setSession(advance(session))}
        onQuit={quit}
      />
    );
  }

  return (
    <ReviewDesk
      catalog={catalog}
      now={now}
      busy={starting}
      notice={notice}
      error={error}
      onStart={(request) => void start(request)}
    />
  );
}

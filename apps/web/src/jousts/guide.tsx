"use client";

import type { CatalogCard, JoustDeckResponse } from "@leximon/contract";
import {
  COMPOSE_DECK,
  FURET,
  FURET_RUN,
  GUIDE_DECK_SAVED,
  GUIDE_LATER,
  GUIDE_NO_DECK,
  GUIDE_SKIP,
  GUIDE_STEPS,
  GUIDE_UNDERSTOOD,
  type GuideStep,
  guideLine,
  guideRules,
  LAUNCH_RANKED,
  type RunSize,
  TRAINING_CONTINUE,
  TRAINING_KICKER,
  type TrainingQuestion,
  trainingClosing,
  trainingOutcome,
  trainingQuestions,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { MainAction, PaperAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { catalogCard } from "@/trades/card-thumb";
import { Icon, type IconName } from "@/ui/icon";
import { Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import { DeckBuilder } from "./deck-builder";
import styles from "./jousts.module.css";
import { type Duelist, DuelistFace, Furet, MiniCard, rise } from "./pieces";
import { Reveal, type RevealAnswer } from "./reveal";
import { RunScene, type RunSource } from "./run-scene";

const FURET_DUELIST: Duelist = { name: FURET, avatar: null, frame: null, furet: true };
const RULE_ICONS: readonly IconName[] = ["clock", "check", "bolt"];

/**
 * The first visit to the jousts, with Maître Furet: the lists, the player's deck, a training run
 * against him, then the first joust. Each step can be passed; closing it marks it done.
 */
export function Guide({
  deck,
  deckSaved,
  jousted,
  size,
  me,
  busy,
  refusal,
  onDeckSaved,
  onLaunch,
  onClose,
}: {
  readonly deck: JoustDeckResponse;
  readonly deckSaved: boolean;
  /** The player jousted before composing a deck: the deck they played starts in place. */
  readonly jousted: boolean;
  readonly size: RunSize;
  readonly me: Duelist;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onDeckSaved: () => void;
  readonly onLaunch: () => void;
  readonly onClose: () => void;
}) {
  const [step, setStep] = useState<GuideStep>(0);
  const next = () => (step === 3 ? onClose() : setStep((step + 1) as GuideStep));
  return (
    <section className={`${ui.leaf} ${styles.guide} ${desk.rising}`} style={rise(0)}>
      <header className={styles.guideHead}>
        <ol className={styles.steps}>
          {GUIDE_STEPS.map((label, index) => (
            <li
              key={label}
              data-on={index === step || undefined}
              data-done={index < step || undefined}
            >
              <button type="button" onClick={() => setStep(index as GuideStep)}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={styles.skip} onClick={next}>
          {GUIDE_SKIP}
        </button>
      </header>

      {step === 0 && <GuideLists deck={deck} size={size} me={me} onNext={next} />}
      {step === 1 && (
        <DeckBuilder
          deck={deck}
          initial={deck.saved || jousted ? deck.cardIds : []}
          intro={
            <Furet>
              <p>{guideLine(1, size, deck)}</p>
            </Furet>
          }
          onSaved={() => {
            onDeckSaved();
            next();
          }}
        />
      )}
      {step === 2 && <Training deck={deck} size={size} me={me} onNext={next} />}
      {step === 3 && (
        <div className={styles.firstJoust}>
          <Furet>
            <p>{deckSaved ? guideLine(3, size, deck) : GUIDE_NO_DECK}</p>
            {deckSaved && <p>{GUIDE_DECK_SAVED}</p>}
          </Furet>
          {refusal !== null && (
            <p className={styles.notice} role="alert">
              {refusal}
            </p>
          )}
          <div className={styles.firstJoustAction}>
            {deckSaved ? (
              <MainAction label={LAUNCH_RANKED} disabled={busy} onClick={onLaunch} />
            ) : (
              <MainAction label={COMPOSE_DECK} onClick={() => setStep(1)} />
            )}
            <PaperAction label={GUIDE_LATER} onClick={onClose} />
          </div>
        </div>
      )}
    </section>
  );
}

/** The lists: the player's cards cross to the other side, the other's come to theirs. */
function GuideLists({
  deck,
  size,
  me,
  onNext,
}: {
  readonly deck: JoustDeckResponse;
  readonly size: RunSize;
  readonly me: Duelist;
  readonly onNext: () => void;
}) {
  const catalog = useCatalog();
  const sides = useMemo(() => {
    if (catalog === null) return null;
    const mine = deck.cardIds.slice(0, size.questions).map((id) => catalogCard(catalog, id));
    const taken = new Set(mine.map((card) => card.id));
    const theirs = [...catalog.cardsById.values()]
      .filter((card) => !taken.has(card.id) && card.rarity !== "common")
      .slice(0, size.questions);
    return { mine, theirs };
  }, [catalog, deck.cardIds, size.questions]);
  const cards = (list: readonly CatalogCard[], cross: string | undefined) =>
    list.map((card, index) => (
      <MiniCard
        key={card.id}
        card={card}
        className={cross}
        style={{ "--i": index } as CSSProperties}
      />
    ));
  return (
    <div className={styles.lists}>
      <Furet>
        <p>{guideLine(0, size, deck)}</p>
      </Furet>
      <div className={styles.listsField}>
        <div className={styles.listsSide}>
          <DuelistFace duelist={me} size={56} />
          <span className={styles.listsName}>Ton deck</span>
          <div className={styles.listsCards}>
            {sides !== null && cards(sides.mine, styles.crossRight)}
          </div>
        </div>
        <Lettering className={styles.versus}>contre</Lettering>
        <div className={styles.listsSide}>
          <span className={styles.medallion} data-tone="red" aria-hidden="true">
            ?
          </span>
          <span className={styles.listsName}>Son deck</span>
          <div className={styles.listsCards}>
            {sides !== null && cards(sides.theirs, styles.crossLeft)}
          </div>
        </div>
      </div>
      <ul className={styles.ruleIcons}>
        {guideRules(size).map((rule, index) => (
          <li key={rule}>
            <Icon name={RULE_ICONS[index] ?? "check"} size={22} />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <div className={styles.guideAction}>
        <PaperAction label={GUIDE_UNDERSTOOD} onClick={onNext} />
      </div>
    </div>
  );
}

/** Three words against Maître Furet on the real clock, then the result as a joust reveals it. */
function Training({
  deck,
  size,
  me,
  onNext,
}: {
  readonly deck: JoustDeckResponse;
  readonly size: RunSize;
  readonly me: Duelist;
  readonly onNext: () => void;
}) {
  const catalog = useCatalog();
  // Drawn once: the deck reloaded after its save must not change the questions mid-run.
  const [questions, setQuestions] = useState<readonly TrainingQuestion[] | null>(null);
  useEffect(() => {
    if (catalog === null || questions !== null) return;
    const all = [...catalog.cardsById.values()];
    const known = deck.candidates.map((candidate) => catalogCard(catalog, candidate.cardId));
    setQuestions(trainingQuestions(known, all, size.choices, Math.random));
  }, [catalog, questions, deck.candidates, size.choices]);
  const answers = useRef(new Map<number, RevealAnswer>());
  const source = useMemo(
    () =>
      questions === null ? null : trainingSource(questions, size.seconds * 1000, answers.current),
    [questions, size.seconds],
  );
  const [over, setOver] = useState(false);

  if (questions === null || source === null) return <div className={styles.questionWait} />;
  if (!over) {
    return (
      <div className={styles.training}>
        <Furet>
          <p>{guideLine(2, size, deck)}</p>
        </Furet>
        <RunScene
          source={source}
          me={me}
          them={FURET_DUELIST}
          ghost={FURET_RUN}
          questions={questions.length}
          answered={0}
          kicker={TRAINING_KICKER}
          doneLabel={TRAINING_CONTINUE}
          onDone={() => setOver(true)}
        />
      </div>
    );
  }
  const mine = questions.map(
    (question, position) =>
      answers.current.get(position) ?? {
        cardId: question.cardId,
        correct: false,
        ms: size.seconds * 1000,
      },
  );
  const theirs = questions.map((question, position) => ({
    cardId: question.cardId,
    correct: FURET_RUN[position]?.correct ?? false,
    ms: FURET_RUN[position]?.ms ?? 0,
  }));
  const outcome = trainingOutcome(mine);
  return (
    <Reveal
      data={{
        me,
        them: FURET_DUELIST,
        mine,
        theirs,
        outcome,
        gains: null,
        closing: trainingClosing(outcome),
        wished: null,
      }}
      kicker={TRAINING_KICKER}
      playing
    >
      <MainAction label={TRAINING_CONTINUE} onClick={onNext} />
    </Reveal>
  );
}

/** The training's questions on this device's clock, with the answers kept for its result. */
function trainingSource(
  questions: readonly TrainingQuestion[],
  answerMs: number,
  answers: Map<number, RevealAnswer>,
): RunSource {
  return {
    graceMs: 0,
    async next(after) {
      const position = after === null ? 0 : after + 1;
      const question = questions[position];
      if (question === undefined) return { kind: "over" };
      return {
        kind: "question",
        question: {
          position,
          definition: question.definition,
          choices: question.choices,
          deadline: Date.now() + answerMs,
          totalMs: answerMs,
        },
      };
    },
    async answer(served, cardId) {
      const question = questions[served.position];
      const rightCardId = question?.cardId ?? "";
      const late = Date.now() > served.deadline;
      const correct = !late && cardId === rightCardId;
      answers.set(served.position, {
        cardId: rightCardId,
        correct,
        ms: Math.min(answerMs, answerMs - (served.deadline - Date.now())),
      });
      return { correct, rightCardId, late, runOver: served.position === questions.length - 1 };
    },
  };
}

"use client";

import type { JoustView, Progress } from "@leximon/contract";
import {
  BACK_TO_JOUSTS,
  NEW_JOUST,
  RUN_DONE,
  runSeconds,
  TRAPS_TITLE,
  trapsLine,
  waitingLine,
  xpGainText,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { useNarrow } from "@/lib/use-narrow";
import { Desk, MainAction, PaperAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { catalogCard } from "@/trades/card-thumb";
import { Icon } from "@/ui/icon";
import { Lettering } from "@/ui/toy";
import styles from "./jousts.module.css";
import { AnswerCards, type Duelist, DuelistFace, MiniCard, rise } from "./pieces";

/** Counts up to `target`, one step at a time, after `startMs`. */
function useTicker(target: number, startMs: number, stepMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const timers = Array.from({ length: target }, (_, index) =>
      window.setTimeout(() => setValue(index + 1), startMs + index * stepMs),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [target, startMs, stepMs]);
  return value;
}

/** The cards turn one by one, then the score is struck on its plaque and the XP flows in. */
const _CARD_MS = 260;
const STRIKE_MS = 1_500;
const XP_MS = 1_900;

/**
 * The player's run is played, the other's not yet, as a scene on the green desk: the answers
 * turn one by one, the score is struck on a gold plaque and counts, the XP fills the bar with the
 * sound of coins; then the words the other has to find, and how long they have.
 */
export function RunSummary({
  view,
  them,
  kicker,
  progress,
  busy,
  refusal,
  onNew,
  onBack,
}: {
  readonly view: JoustView;
  readonly them: Duelist;
  readonly kicker: string;
  readonly progress: Progress | null;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onNew: () => void;
  readonly onBack: () => void;
}) {
  const catalog = useCatalog();
  const narrow = useNarrow();
  const answers = view.run?.answers ?? [];
  const xp = view.run?.xp ?? 0;
  const found = answers.filter((answer) => answer.correct).length;
  const counted = useTicker(found, STRIKE_MS + 200, 220);
  const traps = view.traps ?? [];

  useEffect(() => {
    play("recap");
    const strike = window.setTimeout(() => {
      play("crack");
      vibrate([20]);
    }, STRIKE_MS);
    const coins = xp > 0 ? window.setTimeout(() => play("coins"), XP_MS) : undefined;
    return () => {
      window.clearTimeout(strike);
      window.clearTimeout(coins);
    };
  }, [xp]);

  return (
    <section className={`${styles.arena} ${styles.summary} ${desk.rising}`} style={rise(0)}>
      <Desk className={styles.arenaDesk} />
      <div className={styles.arenaTop}>
        <span className={styles.arenaKicker}>{kicker}</span>
      </div>
      <Lettering className={styles.summaryTitle}>{RUN_DONE}</Lettering>
      <AnswerCards answers={answers} width={narrow ? 56 : 100} />
      <div className={styles.plaque} style={{ "--strike": `${STRIKE_MS}ms` } as CSSProperties}>
        <Lettering className={styles.plaqueFigure}>
          {counted} / {answers.length}
        </Lettering>
        <span className={styles.plaqueTime}>
          <Icon name="clock" size={16} /> {runSeconds(answers)}
        </span>
      </div>
      {xp > 0 && progress !== null && <XpBar progress={progress} xp={xp} />}

      <div className={styles.summaryWait}>
        <div className={styles.waiting}>
          <DuelistFace duelist={them} size={52} />
          <span className={styles.hourglass}>
            <Icon name="clock" size={20} />
          </span>
          <p>{waitingLine(view.summary.opponent, view.summary.replyBy, Date.now())}</p>
        </div>
        <p className={styles.trapsText}>
          <b>{TRAPS_TITLE}.</b> {trapsLine(traps.length, view.summary.opponent)}
        </p>
        {catalog !== null && (
          <div className={styles.traps}>
            {traps.map((cardId, index) => (
              <MiniCard
                key={cardId}
                card={catalogCard(catalog, cardId)}
                width={narrow ? 52 : 70}
                className={styles.trapCard}
                style={{ "--i": index } as CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
      {refusal !== null && (
        <p className={styles.notice} role="alert">
          {refusal}
        </p>
      )}
      <div className={styles.runActions}>
        <MainAction label={NEW_JOUST} disabled={busy} onClick={onNew} />
        <PaperAction label={BACK_TO_JOUSTS} onClick={onBack} />
      </div>
    </section>
  );
}

/** The level's bar, filling with what the run gave. */
function XpBar({ progress, xp }: { readonly progress: Progress; readonly xp: number }) {
  const total = Math.max(1, progress.xpForNextLevel);
  const to = Math.min(100, (progress.xpIntoLevel / total) * 100);
  const from = Math.max(0, ((progress.xpIntoLevel - xp) / total) * 100);
  return (
    <div className={styles.xp}>
      <span className={styles.xpLabel}>Niveau {progress.level}</span>
      <span className={styles.xpBar} aria-hidden="true">
        <span style={{ "--from": `${from}%`, "--to": `${to}%` } as CSSProperties} />
      </span>
      <Lettering className={styles.xpGain}>{xpGainText(xp)}</Lettering>
    </div>
  );
}

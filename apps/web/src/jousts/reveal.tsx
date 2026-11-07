"use client";

import type { JoustOutcome, JoustView } from "@leximon/contract";
import { rarityLights, revealEffects } from "@leximon/tokens";
import {
  answerTimeText,
  OPEN_SEALED,
  outcomeWord,
  REPLAY_REVEAL,
  SEALED_RESULT,
  sachetGainText,
  tournamentGain,
  xpGainText,
} from "@leximon/view-model";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { play, vibrate } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import desk from "@/play/desk-columns.module.css";
import { catalogCard } from "@/trades/card-thumb";
import { Icon } from "@/ui/icon";
import { useStage } from "@/ui/stage";
import { Lettering, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./jousts.module.css";
import { Shield, TournamentGain } from "./league-pieces";
import { type Duelist, DuelistFace, rise } from "./pieces";

export interface RevealAnswer {
  readonly cardId: string;
  readonly correct: boolean;
  readonly ms: number;
}

export interface RevealData {
  readonly me: Duelist;
  readonly them: Duelist;
  readonly mine: readonly RevealAnswer[];
  /** `null` when the other never played. */
  readonly theirs: readonly RevealAnswer[] | null;
  readonly outcome: JoustOutcome | null;
  /** What the joust gave; `null` in training. */
  readonly gains: {
    readonly xp: number;
    readonly boosters: number;
    /** A ranked joust's tournament points. */
    readonly tournament: NonNullable<JoustView["result"]>["tournament"];
  } | null;
  /** The last line: the words that trapped the other, or why the joust ended without them. */
  readonly closing: string | null;
}

const ROW_MS = 650;
const FIRST_ROW_MS = 900;

/** A result not watched yet: a sealed letter to break. */
export function SealedResult({
  kicker,
  onOpen,
}: {
  readonly kicker: string;
  readonly onOpen: () => void;
}) {
  return (
    <section className={`${ui.leaf} ${styles.sealed} ${desk.rising}`} style={rise(0)}>
      <span className={desk.leafKicker}>{kicker}</span>
      <button type="button" className={styles.pli} onClick={onOpen}>
        <span className={styles.pliSeal}>
          <ToyIcon name="mail" size={88} />
        </span>
        <Lettering className={styles.pliLabel}>{SEALED_RESULT}</Lettering>
        <span className={styles.pliHint}>{OPEN_SEALED}</span>
      </button>
    </section>
  );
}

/**
 * The result: the two players face to face, the questions turned row by row with the scores
 * climbing, the banner with its fanfare, then what the joust gave. Played once when `playing`;
 * otherwise shown whole, with « Revoir ».
 */
export function Reveal({
  data,
  kicker,
  playing,
  children,
}: {
  readonly data: RevealData;
  readonly kicker: string;
  readonly playing: boolean;
  /** The actions under the gains. */
  readonly children?: ReactNode;
}) {
  const stage = useStage();
  const catalog = useCatalog();
  const rows = data.mine.length;
  const [shown, setShown] = useState(playing ? 0 : rows);
  const [verdict, setVerdict] = useState(!playing);
  const [gains, setGains] = useState(!playing);
  const timers = useRef<number[]>([]);
  const banner = useRef<HTMLDivElement>(null);
  const won = data.outcome === "won";

  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the sequence reads the data it starts with
  const start = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setShown(0);
    setVerdict(false);
    setGains(false);
    play("sealBreak");
    for (let index = 0; index < rows; index += 1) {
      later(FIRST_ROW_MS + index * ROW_MS, () => {
        setShown(index + 1);
        play("flip");
      });
    }
    const verdictAt = FIRST_ROW_MS + rows * ROW_MS + 300;
    later(verdictAt, () => {
      setVerdict(true);
      play(won ? "fanfareEpic" : "recap");
      vibrate(won ? [30, 40, 60] : [30]);
      const element = banner.current;
      if (won && element !== null) {
        const box = element.getBoundingClientRect();
        stage.reveal(
          box.left + box.width / 2,
          box.top + box.height / 2,
          revealEffects.epic,
          rarityLights.epic[0] ?? "white",
          element,
        );
      }
    });
    later(verdictAt + 1_200, () => {
      setGains(true);
      const gained = (data.gains?.tournament?.won ?? 0) > 0;
      if (data.gains !== null && (data.gains.xp > 0 || data.gains.boosters > 0 || gained)) {
        play("coins");
      }
    });
  }, [rows, won]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once, when asked at the start
  useEffect(() => {
    if (playing) start();
  }, []);

  const word = (cardId: string) => (catalog === null ? "…" : catalogCard(catalog, cardId).word);
  const score = (answers: readonly RevealAnswer[] | null) =>
    (answers ?? []).slice(0, shown).filter((answer) => answer.correct).length;
  return (
    <section className={`${ui.leaf} ${styles.result} ${desk.rising}`} style={rise(0)}>
      <header className={styles.joustHead}>
        <span className={desk.leafKicker}>{kicker}</span>
        <button type="button" className={styles.replay} onClick={start}>
          <Icon name="play" size={14} /> {REPLAY_REVEAL}
        </button>
      </header>
      <div className={styles.board}>
        <div className={styles.boardSide}>
          <DuelistFace duelist={data.me} size={64} />
          <Lettering className={styles.boardName}>{data.me.name}</Lettering>
          <Lettering className={styles.boardScore}>{score(data.mine)}</Lettering>
        </div>
        <ol className={styles.boardRows}>
          {data.mine.map((answer, index) => {
            const theirs = data.theirs?.[index];
            return (
              <li
                key={answer.cardId}
                className={styles.boardRow}
                data-visible={index < shown || undefined}
              >
                <BoardCell answer={answer} word={word(answer.cardId)} side="me" />
                <span className={styles.boardNumber}>{index + 1}</span>
                {theirs !== undefined ? (
                  <BoardCell answer={theirs} word={word(theirs.cardId)} side="them" />
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ol>
        <div className={styles.boardSide}>
          <DuelistFace duelist={data.them} size={64} />
          <Lettering className={styles.boardName}>{data.them.name}</Lettering>
          <Lettering className={styles.boardScore}>{score(data.theirs)}</Lettering>
        </div>
      </div>

      <div
        ref={banner}
        className={styles.banner}
        data-shown={verdict || undefined}
        data-won={won || undefined}
      >
        {verdict && (
          <Lettering className={styles.bannerWord}>{outcomeWord(data.outcome, true)}</Lettering>
        )}
      </div>

      {gains && (
        <div className={styles.gains}>
          {data.gains !== null && data.gains.xp > 0 && (
            <span className={styles.gain} style={{ "--i": 0 } as CSSProperties}>
              <ToyIcon name="challenge" size={34} />
              <Lettering>{xpGainText(data.gains.xp)}</Lettering>
            </span>
          )}
          {data.gains !== null && data.gains.boosters > 0 && (
            <span className={styles.gain} style={{ "--i": 1 } as CSSProperties}>
              <ToyIcon name="sachet" size={34} />
              <Lettering>{sachetGainText(data.gains.boosters)}</Lettering>
            </span>
          )}
          {data.gains?.tournament != null && (
            <>
              <span className={styles.gain} style={{ "--i": 2 } as CSSProperties}>
                <Shield league={data.gains.tournament.league} size={30} />
                <Lettering>{tournamentGain(data.gains.tournament).points}</Lettering>
              </span>
              <TournamentGain tournament={data.gains.tournament} />
            </>
          )}
          {data.closing !== null && (
            <p className={styles.trapped}>
              <ToyIcon name="jousts" size={22} /> {data.closing}
            </p>
          )}
          {children !== undefined && <div className={styles.runActions}>{children}</div>}
        </div>
      )}
    </section>
  );
}

function BoardCell({
  answer,
  word,
  side,
}: {
  readonly answer: RevealAnswer;
  readonly word: string;
  readonly side: "me" | "them";
}) {
  return (
    <span className={styles.boardCell} data-side={side} data-right={answer.correct || undefined}>
      <Icon name={answer.correct ? "check" : "close"} size={14} />
      <span className={styles.boardWord}>{word}</span>
      <span className={styles.boardTime}>{answer.correct ? answerTimeText(answer) : "—"}</span>
    </span>
  );
}

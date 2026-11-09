"use client";

import { effects } from "@leximon/tokens";
import {
  CLIMB_KICKER,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  type LeagueClimb,
} from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { MainAction } from "@/library/play-pieces";
import { useStage } from "@/ui/stage";
import { Lettering, ToyIcon } from "@/ui/toy";
import styles from "./climb-scene.module.css";
import { Crest } from "./crest";
import { Arena } from "./start-scene";
import arena from "./start-scene.module.css";

/** The old crest trembles this long, then breaks; the new one falls once the halves are gone. */
const TREMBLE_MS = 900;
const BREAK_MS = 600;
const FALL_MS = 380;

/**
 * A league climbed, played like a level reached: the old crest trembles and breaks, the new one
 * falls in a rain of gold, then what the week gives and the button that claims it.
 */
export function ClimbScene({
  climb,
  busy,
  refusal,
  onClaim,
}: {
  readonly climb: LeagueClimb;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onClaim: () => void;
}) {
  const stage = useStage();
  const [phase, setPhase] = useState<"old" | "break" | "new">("old");
  const crest = useRef<HTMLDivElement>(null);

  useEffect(() => {
    play("rumble");
    const crack = window.setTimeout(() => {
      setPhase("break");
      play("crack");
      vibrate([30]);
    }, TREMBLE_MS);
    const land = window.setTimeout(() => setPhase("new"), TREMBLE_MS + BREAK_MS);
    return () => {
      window.clearTimeout(crack);
      window.clearTimeout(land);
    };
  }, []);

  useEffect(() => {
    if (phase !== "new") return;
    const fall = window.setTimeout(() => {
      const box = crest.current?.getBoundingClientRect();
      if (box !== undefined) {
        stage.burst(box.left + box.width / 2, box.top + box.height / 2, effects.reward);
      }
      stage.rain(40);
      play("fanfareEpic");
      vibrate([20, 60, 40]);
    }, FALL_MS);
    return () => window.clearTimeout(fall);
  }, [phase, stage]);

  return (
    <Arena>
      <span className={arena.kicker}>{CLIMB_KICKER}</span>
      <div className={styles.stage} ref={crest}>
        {phase !== "new" ? (
          <span className={styles.old} data-break={phase === "break" || undefined}>
            <span className={styles.half} data-half="left">
              <Crest league={climb.from} size={170} />
            </span>
            <span className={styles.half} data-half="right">
              <Crest league={climb.from} size={170} />
            </span>
          </span>
        ) : (
          <span className={styles.new}>
            <span className={styles.glow} aria-hidden="true" />
            <Crest league={climb.to} size={190} />
          </span>
        )}
      </div>
      {phase === "new" && (
        <div className={styles.text}>
          <Lettering className={arena.title}>{climb.title}</Lettering>
          <p className={arena.line}>{climb.line}</p>
          <div className={styles.gains}>
            {climb.gains.map((gain) => (
              <span key={gain.text} className={styles.gain}>
                <ToyIcon name={gain.icon} size={28} /> {gain.text}
              </span>
            ))}
          </div>
          <MainAction
            label={busy ? LEAGUE_CLAIM_BUSY : LEAGUE_CLAIM}
            disabled={busy}
            onClick={onClaim}
          />
          {refusal !== null && (
            <p className={styles.refusal} role="alert">
              {refusal}
            </p>
          )}
        </div>
      )}
    </Arena>
  );
}

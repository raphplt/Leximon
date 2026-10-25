"use client";

import type { PodiumResponse } from "@leximon/contract";
import {
  answersLabel,
  goalTimeLeft,
  PODIUM_ALONE,
  PODIUM_EMPTY,
  playerName,
  podiumView,
  rankLabel,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Bone } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import styles from "./friends.module.css";

/** The week's podium among friends, on correct challenge answers. No reward. */
export function Podium({ alone, now }: { readonly alone: boolean; readonly now: number }) {
  const [podium, setPodium] = useState<PodiumResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [unfolded, setUnfolded] = useState(false);

  useEffect(() => {
    api
      .fetchPodium()
      .then(setPodium)
      .catch(() => setFailed(true));
  }, []);

  const view = podium === null ? null : podiumView(podium.entries);
  return (
    <section className={`${ui.panel} ${styles.card}`}>
      <div className={styles.cardHead}>
        <p className={ui.kicker}>Podium de la semaine</p>
        {podium !== null && (
          <span className={styles.small}>{goalTimeLeft(podium.weekEnd, now)}</span>
        )}
      </div>
      {view === null ? (
        failed ? (
          <p className={styles.small}>Le podium ne répond pas.</p>
        ) : (
          <Bone className={styles.podiumBone} />
        )
      ) : alone ? (
        <p className={styles.empty}>{PODIUM_ALONE}</p>
      ) : view.empty ? (
        <p className={styles.empty}>{PODIUM_EMPTY}</p>
      ) : (
        <>
          <ol className={styles.steps}>
            {view.steps.map((entry, index) => (
              <li
                key={entry.player.code}
                className={styles.step}
                data-place={index + 1}
                data-self={entry.self}
              >
                <Avatar avatar={entry.player.avatar} frame={null} size={index === 0 ? 56 : 44} />
                <span className={styles.stepName}>
                  {entry.self ? "Toi" : playerName(entry.player)}
                </span>
                <span className={styles.stepAnswers}>{entry.answers}</span>
                <span className={styles.stepBlock}>{rankLabel(entry.rank)}</span>
              </li>
            ))}
          </ol>
          {view.mine !== null && <p className={styles.mine}>Toi : {view.mine}</p>}
          {view.all.length > 3 &&
            (unfolded ? (
              <ol className={styles.ranking}>
                {view.all.map((entry) => (
                  <li key={entry.player.code} data-self={entry.self}>
                    <span className={styles.rankNumber}>{rankLabel(entry.rank)}</span>
                    <span className={styles.rankName}>
                      {entry.self ? "Toi" : playerName(entry.player)}
                    </span>
                    <span className={styles.small}>{answersLabel(entry.answers)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Button variant="ghost" small onClick={() => setUnfolded(true)}>
                Tout le classement
              </Button>
            ))}
        </>
      )}
    </section>
  );
}

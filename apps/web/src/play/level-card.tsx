"use client";

import {
  coffretsLabel,
  levelDescription,
  levelRatio,
  upcomingRewards,
  xpProgressLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { REWARD_ICONS } from "@/shell/reward-icons";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level-bits";
import styles from "./play.module.css";

/** The level card beside the counter: medal, XP, the next rewards, the coffrets waiting. */
export function LevelCard() {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const { progress } = view;
  if (progress === null) return <section className={`${styles.card} ${styles.cardLoading}`} />;
  const next = view.now === 0 ? [] : upcomingRewards(progress.level, view.now, 5);
  return (
    <section className={styles.card} aria-label="Ton niveau">
      <Link href="/niveaux" className={styles.levelHead} aria-label={levelDescription(progress)}>
        <LevelMedal level={progress.level} size={56} />
        <span className={styles.levelText}>
          <span className={styles.levelName}>Niveau {progress.level}</span>
          {view.title !== null && <span className={styles.levelTitle}>{view.title}</span>}
        </span>
      </Link>
      <div className={styles.xp}>
        <XpBar ratio={levelRatio(progress)} />
        <span className={styles.xpNumbers}>{xpProgressLabel(progress)}</span>
      </div>
      <ol className={styles.next} aria-label="Prochaines récompenses">
        {next.map((reward) => (
          <li key={reward.level}>
            <Link
              href={`/niveaux#niveau-${reward.level}`}
              className={styles.nextReward}
              aria-label={reward.label}
            >
              <span className={reward.milestone ? styles.nextIconKraft : styles.nextIcon}>
                <Icon name={REWARD_ICONS[reward.icon]} size={18} />
              </span>
              <span className={styles.nextLevel}>{reward.level}</span>
              <span className={styles.nextText}>
                <span className={reward.milestone ? styles.nextTitleKraft : styles.nextTitle}>
                  {reward.title}
                </span>
                {reward.opens !== null && <span className={styles.nextOpens}>{reward.opens}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {view.coffrets.length > 0 && (
        <Button small glow wide className={styles.claim} onClick={() => openCoffret()}>
          <Icon name="coffret" size={20} />
          {coffretsLabel(view.coffrets.length)}
        </Button>
      )}
    </section>
  );
}

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
import ui from "@/ui/ui.module.css";
import styles from "./play.module.css";

/** The level band of the Jouer screen: medal, XP, next rewards, coffrets. */
export function LevelStrip() {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const { progress } = view;
  if (progress === null)
    return <div className={`${ui.panel} ${styles.strip} ${styles.stripLoading}`} />;
  const next = view.now === 0 ? [] : upcomingRewards(progress.level, view.now);
  return (
    <div className={`${ui.panel} ${ui.enter} ${styles.strip}`}>
      <Link href="/niveaux" className={styles.medalLink} aria-label="Chemin des niveaux">
        <LevelMedal level={progress.level} size={64} />
      </Link>
      <Link href="/niveaux" className={styles.xp} aria-label={levelDescription(progress)}>
        <span className={styles.xpHead}>
          <span className={styles.headline}>
            Niveau {progress.level}
            {view.title !== null && <span className={styles.title}> · {view.title}</span>}
          </span>
          <span className={styles.xpNumbers}>{xpProgressLabel(progress)}</span>
        </span>
        <XpBar ratio={levelRatio(progress)} />
      </Link>
      <ol className={styles.next} aria-label="Prochaines récompenses">
        {next.map((reward) => (
          <li key={reward.level} className={styles.nextItem}>
            <span className={styles.nextLink} aria-hidden="true" />
            <Link
              href={`/niveaux#niveau-${reward.level}`}
              className={styles.nextReward}
              aria-label={reward.label}
              title={reward.label}
            >
              <span className={reward.milestone ? styles.nextIconKraft : styles.nextIcon}>
                <Icon name={REWARD_ICONS[reward.icon]} size={22} />
              </span>
              <span className={styles.nextLevel}>Niv. {reward.level}</span>
            </Link>
          </li>
        ))}
      </ol>
      {view.coffrets.length > 0 && (
        <Button small glow className={styles.claim} onClick={() => openCoffret()}>
          <Icon name="coffret" size={20} />
          {coffretsLabel(view.coffrets.length)}
        </Button>
      )}
    </div>
  );
}

"use client";

import {
  levelDescription,
  levelRatio,
  nextRewardLine,
  upcomingRewards,
  xpProgressLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { REWARD_ICONS } from "@/shell/reward-icons";
import { usePlayerView } from "@/shell/use-player-view";
import { Icon } from "@/ui/icon";
import { XpBar } from "@/ui/level-bits";
import ui from "@/ui/ui.module.css";
import styles from "./play.module.css";

/**
 * Beside the button of « La Bibliothèque »: the next level's reward alone, and how far it is.
 * The level itself is already in the band at the top.
 */
export function NextReward() {
  const view = usePlayerView();
  const { progress } = view;
  if (progress === null || view.now === 0) return null;
  const [reward] = upcomingRewards(progress.level, view.now, 1);
  if (reward === undefined) return null;
  const line = nextRewardLine(progress.level, view.now);
  return (
    <Link
      href={`/niveaux#niveau-${reward.level}`}
      className={`${styles.reward} ${ui.leaf}`}
      aria-label={`${levelDescription(progress)}. ${line}`}
    >
      <span className={reward.milestone ? styles.nextIconKraft : styles.nextIcon}>
        <Icon name={REWARD_ICONS[reward.icon]} size={22} />
      </span>
      <span className={styles.rewardBody}>
        <span className={styles.rewardLine}>{line}</span>
        <span className={styles.rewardProgress}>
          <XpBar ratio={levelRatio(progress)} thin className={styles.rewardBar} />
          <span className={styles.rewardXp}>{xpProgressLabel(progress)}</span>
        </span>
      </span>
    </Link>
  );
}

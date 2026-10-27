"use client";

import type { PlayerBadge } from "@leximon/contract";
import { playerName, profilePath } from "@leximon/view-model";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { LevelMedal } from "@/ui/level-bits";
import styles from "./trades.module.css";

/** The other player of an offer: avatar, pseudo or code, level; « Un joueur parti » once gone. */
export function Counterpart({
  player,
  prefix = "",
}: {
  readonly player: PlayerBadge | null;
  readonly prefix?: string;
}) {
  const name = playerName(player);
  return (
    <p className={styles.counterpart}>
      <Avatar avatar={player?.avatar ?? null} frame={player?.frame ?? null} size={30} />
      <span>
        {prefix}
        {player?.pseudo != null ? (
          <Link href={profilePath(player.pseudo)} className={styles.counterpartLink}>
            {name}
          </Link>
        ) : (
          name
        )}
      </span>
      {player !== null && <LevelMedal level={player.level} size={26} labelled />}
    </p>
  );
}

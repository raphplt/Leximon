"use client";

import type { DirectoryPlayer } from "@leximon/contract";
import {
  NO_PLAYER_FOUND,
  noPlayerYet,
  PLAYER_SEARCH_LABEL,
  playerListNote,
  profilePath,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clanStyles from "@/clan/clan.module.css";
import { Emblem } from "@/clan/emblem";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { Bone } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import styles from "./community.module.css";

/** Rows standing in for the first players while they arrive. */
const WAITING_ROWS = [1, 2, 3];

/** Every public profile, the latest seen first. */
export function PlayerList() {
  const me = useShared(profile);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<readonly DirectoryPlayer[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const read = useCallback(async (q: string, isCurrent: () => boolean) => {
    const page = await api.fetchPublicPlayers({ q }).catch(() => null);
    if (!isCurrent()) return;
    setFailed(page === null);
    setPlayers(page?.players ?? null);
    setCursor(page?.nextCursor ?? null);
  }, []);

  // Searches as the pseudo is typed, once the player pauses.
  useEffect(() => {
    let current = true;
    const q = query.trim();
    const timer = setTimeout(() => void read(q, () => current), q === "" ? 0 : 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, read]);

  const more = async () => {
    if (cursor === null) return;
    const page = await api.fetchPublicPlayers({ q: query.trim(), cursor }).catch(() => null);
    if (page === null) return;
    // The list follows activity: someone back in the game may come round again.
    setPlayers((shown) => {
      const known = new Set((shown ?? []).map((entry) => entry.player.code));
      return [...(shown ?? []), ...page.players.filter((entry) => !known.has(entry.player.code))];
    });
    setCursor(page.nextCursor);
  };

  const note = me === null ? null : playerListNote(me);
  return (
    <section>
      {note !== null && <p className={styles.note}>{note}</p>}
      <label className={clanStyles.search}>
        <Icon name="search" size={18} />
        <span className={clanStyles.visuallyHidden}>{PLAYER_SEARCH_LABEL}</span>
        <input
          className={clanStyles.searchInput}
          value={query}
          maxLength={30}
          autoComplete="off"
          placeholder={PLAYER_SEARCH_LABEL}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {failed ? (
        <LoadFailed onRetry={() => void read(query.trim(), () => true)} />
      ) : players === null ? (
        <div aria-busy="true">
          <span className={clanStyles.visuallyHidden}>Un instant…</span>
          <ul className={clanStyles.clanList} aria-hidden="true">
            {WAITING_ROWS.map((row) => (
              <li key={row}>
                <Bone className={clanStyles.clanRowBone} />
              </li>
            ))}
          </ul>
        </div>
      ) : players.length === 0 ? (
        <p className={clanStyles.emptyThread}>
          <em>{query.trim() !== "" ? NO_PLAYER_FOUND : noPlayerYet(me?.publicFromLevel ?? 8)}</em>
        </p>
      ) : (
        <ul className={clanStyles.clanList}>
          {players.map((entry) => (
            <li key={entry.player.code}>
              <PlayerRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
      {cursor !== null && (
        <Button variant="ghost" onClick={() => void more()}>
          Voir plus de joueurs
        </Button>
      )}
    </section>
  );
}

/** The row leads to the profile, where everything one can do with a player already is. */
function PlayerRow({ entry }: { readonly entry: DirectoryPlayer }) {
  const { player, clan } = entry;
  return (
    <Link href={profilePath(player.pseudo ?? "")} className={`${ui.panel} ${styles.player}`}>
      <Avatar avatar={player.avatar} frame={player.frame} size={48} />
      <span className={styles.playerText}>
        <span className={styles.playerName}>{player.pseudo}</span>
        <span className={styles.small}>Niveau {player.level}</span>
      </span>
      {clan !== null && (
        <span className={styles.playerClan}>
          <Emblem emblem={clan.emblem} size={28} level={clan.level} />
          <span className={styles.playerClanName}>{clan.name}</span>
        </span>
      )}
    </Link>
  );
}

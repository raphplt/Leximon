"use client";

import type { DirectoryPlayer, PlayerSort } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import {
  CLANLESS_LABEL,
  NO_PINNED_CARD,
  NO_PLAYER_FOR_FILTER,
  NO_PLAYER_FOUND,
  noPlayerYet,
  PLAYER_SEARCH_LABEL,
  PLAYER_SORTS,
  PLAYERS_TITLE,
  playerListNote,
  profilePath,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import clanStyles from "@/clan/clan.module.css";
import { Emblem } from "@/clan/emblem";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { api } from "@/lib/api";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { LoadFailed } from "@/ui/load-failed";
import { Bone } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import styles from "./community.module.css";

/** Cards standing in for the first players while they arrive. */
const WAITING_CARDS = [1, 2, 3, 4, 5, 6];

const CARD_WIDTH = 86;

/** The fan of a player's cards, the last ones turning away from the middle. */
const CARD_TILTS = [-5, 0, 5];

interface Filter {
  readonly q: string;
  readonly sort: PlayerSort;
  readonly clanless: boolean;
}

function asQuery({ q, sort, clanless }: Filter, cursor: string | null) {
  return { q, sort, cursor, ...(clanless ? { clanless: "1" as const } : {}) };
}

/** Every public profile, by the sort the player chose. */
export function PlayerList() {
  const me = useShared(profile);
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlayerSort>("active");
  const [clanless, setClanless] = useState(false);
  const [players, setPlayers] = useState<readonly DirectoryPlayer[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const read = useCallback(async (filter: Filter, isCurrent: () => boolean) => {
    const page = await api.fetchPublicPlayers(asQuery(filter, null)).catch(() => null);
    if (!isCurrent()) return;
    setFailed(page === null);
    setPlayers(page?.players ?? null);
    setCursor(page?.nextCursor ?? null);
  }, []);

  // Searches as the pseudo is typed, once the player pauses.
  useEffect(() => {
    let current = true;
    const q = query.trim();
    const timer = setTimeout(
      () => void read({ q, sort, clanless }, () => current),
      q === "" ? 0 : 300,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, sort, clanless, read]);

  const more = async () => {
    if (cursor === null) return;
    const filter = { q: query.trim(), sort, clanless };
    const page = await api.fetchPublicPlayers(asQuery(filter, cursor)).catch(() => null);
    if (page === null) return;
    // The list follows activity: someone back in the game may come round again.
    setPlayers((shown) => {
      const known = new Set((shown ?? []).map((entry) => entry.player.code));
      return [...(shown ?? []), ...page.players.filter((entry) => !known.has(entry.player.code))];
    });
    setCursor(page.nextCursor);
  };

  const note = me === null ? null : playerListNote(me);
  const filtered = sort === "near" || clanless;
  const empty =
    query.trim() !== ""
      ? NO_PLAYER_FOUND
      : filtered
        ? NO_PLAYER_FOR_FILTER
        : noPlayerYet(me?.publicFromLevel ?? 8);
  return (
    <section>
      <header className={styles.head}>
        <h1 className={`${ui.display} ${styles.title}`}>{PLAYERS_TITLE}</h1>
        <label className={`${clanStyles.search} ${styles.search}`}>
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
      </header>
      <div className={`${clanStyles.chips} ${clanStyles.entryFilter}`}>
        {PLAYER_SORTS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={ui.chip}
            aria-pressed={sort === option.id}
            onClick={() => setSort(option.id)}
          >
            {option.label}
          </button>
        ))}
        <span className={clanStyles.chipsGap} aria-hidden="true" />
        <button
          type="button"
          className={ui.chip}
          aria-pressed={clanless}
          onClick={() => setClanless((on) => !on)}
        >
          {CLANLESS_LABEL}
        </button>
      </div>
      {note !== null && <p className={styles.note}>{note}</p>}
      {failed ? (
        <LoadFailed onRetry={() => void read({ q: query.trim(), sort, clanless }, () => true)} />
      ) : players === null ? (
        <div aria-busy="true">
          <span className={clanStyles.visuallyHidden}>Un instant…</span>
          <ul className={styles.players} aria-hidden="true">
            {WAITING_CARDS.map((row) => (
              <li key={row}>
                <Bone className={styles.playerBone} />
              </li>
            ))}
          </ul>
        </div>
      ) : players.length === 0 ? (
        <p className={clanStyles.emptyThread}>
          <em>{empty}</em>
        </p>
      ) : (
        <ul className={styles.players}>
          {players.map((entry) => (
            <li key={entry.player.code}>
              <PlayerCard entry={entry} catalog={catalog} />
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

/** The card leads to the profile, where everything one can do with a player already is. */
function PlayerCard({
  entry,
  catalog,
}: {
  readonly entry: DirectoryPlayer;
  readonly catalog: Catalog | null;
}) {
  const { player, clan, pinned } = entry;
  return (
    <Link href={profilePath(player.pseudo ?? "")} className={`${ui.panel} ${styles.player}`}>
      <span className={styles.shelf} aria-hidden="true">
        {pinned.length === 0 ? (
          <>
            {CARD_TILTS.map((tilt) => (
              <span key={tilt} className={styles.shelfSlot} style={{ rotate: `${tilt}deg` }} />
            ))}
            <span className={styles.shelfEmpty}>{NO_PINNED_CARD}</span>
          </>
        ) : (
          pinned.map((cardId, index) => {
            const card = catalog?.cardsById.get(cardId);
            return (
              <span
                key={cardId}
                className={styles.shelfCard}
                style={{ rotate: `${CARD_TILTS[pinned.length === 1 ? 1 : index] ?? 0}deg` }}
              >
                {card === undefined || catalog === null ? (
                  <span className={styles.shelfPlaceholder} />
                ) : (
                  <Card
                    card={card}
                    collectionName={collectionName(catalog, card.collectionId)}
                    width={CARD_WIDTH}
                  />
                )}
              </span>
            );
          })
        )}
      </span>
      <span className={styles.identity}>
        <Avatar avatar={player.avatar} frame={player.frame} size={52} />
        <span className={styles.playerText}>
          <span className={styles.playerName}>{player.pseudo}</span>
          <span className={styles.playerLevel}>
            <LevelMedal level={player.level} size={24} labelled />
            {clan !== null && <span className={styles.playerClanName}>{clan.name}</span>}
          </span>
        </span>
        {clan !== null && (
          <span className={styles.playerClan} title={clan.name}>
            <Emblem emblem={clan.emblem} size={34} level={clan.level} />
          </span>
        )}
      </span>
    </Link>
  );
}

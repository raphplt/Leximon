"use client";

import type { ClanEntryMode, ClanSort, ClanSummary } from "@leximon/contract";
import {
  CLAN_SORTS,
  capitalize,
  entryModeLabel,
  joinLabel,
  NO_CLAN_FOUND,
  NO_CLAN_YET,
  plural,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Bone } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import { Banner } from "./banner";
import styles from "./clan.module.css";
import { Emblem } from "./emblem";
import type { ClanJoin } from "./use-join-clan";

const ENTRY_FILTERS: readonly (ClanEntryMode | undefined)[] = [
  undefined,
  "open",
  "request",
  "invite",
];

/** Rows standing in for the first clans while they arrive. */
const WAITING_ROWS = [1, 2, 3, 4];

/**
 * Every clan, by name and way in. Each row leads to the clan's page. `join` adds the button that
 * enters a clan, for a player who may join one.
 */
export function ClanList({ join }: { readonly join: ClanJoin | null }) {
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<ClanEntryMode | undefined>(undefined);
  const [sort, setSort] = useState<ClanSort>("big");
  const [clans, setClans] = useState<readonly ClanSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const filter = useCallback(
    (cursorValue: string | null) => ({
      q: query.trim(),
      cursor: cursorValue,
      sort,
      ...(entry === undefined ? {} : { entry }),
    }),
    [query, entry, sort],
  );

  // Searches as the name is typed, once the player pauses.
  useEffect(() => {
    const timer = setTimeout(
      async () => {
        const page = await api.fetchClans(filter(null)).catch(() => null);
        setClans(page?.clans ?? []);
        setCursor(page?.nextCursor ?? null);
      },
      query === "" ? 0 : 300,
    );
    return () => clearTimeout(timer);
  }, [query, filter]);

  const more = async () => {
    if (cursor === null) return;
    const page = await api.fetchClans(filter(cursor)).catch(() => null);
    if (page === null) return;
    setClans((current) => [...(current ?? []), ...page.clans]);
    setCursor(page.nextCursor);
  };

  return (
    <section>
      <label className={styles.search}>
        <Icon name="search" size={18} />
        <span className={styles.visuallyHidden}>Nom du clan</span>
        <input
          className={styles.searchInput}
          value={query}
          maxLength={30}
          placeholder="Nom du clan"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={`${styles.chips} ${styles.entryFilter}`}>
        {CLAN_SORTS.map((option) => (
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
        <span className={styles.chipsGap} aria-hidden="true" />
        {ENTRY_FILTERS.map((mode) => (
          <button
            key={mode ?? "all"}
            type="button"
            className={ui.chip}
            aria-pressed={entry === mode}
            onClick={() => setEntry(mode)}
          >
            {mode === undefined ? "Tous" : capitalize(entryModeLabel(mode))}
          </button>
        ))}
      </div>
      {clans === null ? (
        <div aria-busy="true">
          <span className={styles.visuallyHidden}>Un instant…</span>
          <ul className={styles.clanList} aria-hidden="true">
            {WAITING_ROWS.map((row) => (
              <li key={row}>
                <Bone className={styles.clanRowBone} />
              </li>
            ))}
          </ul>
        </div>
      ) : clans.length === 0 ? (
        <p className={styles.emptyThread}>
          <em>{query.trim() === "" ? NO_CLAN_YET : NO_CLAN_FOUND}</em>
        </p>
      ) : (
        <ul className={styles.clanList}>
          {clans.map((clan) => (
            <li key={clan.id} className={`${ui.panel} ${styles.clanRow}`}>
              <Banner cardId={clan.banner} />
              <Link href={`/clan/${clan.id}`} className={styles.clanRowLink}>
                <Emblem emblem={clan.emblem} size={60} level={clan.level} />
                <span className={styles.clanRowText}>
                  <span className={styles.clanRowName}>{clan.name}</span>
                  <span className={styles.small}>
                    {plural(clan.memberCount, "membre", "membres")},{" "}
                    {entryModeLabel(clan.entryMode)}
                  </span>
                  {clan.motto !== "" && (
                    <span className={styles.clanRowMotto}>« {clan.motto} »</span>
                  )}
                </span>
              </Link>
              {join !== null && <JoinButton clan={clan} join={join} />}
            </li>
          ))}
        </ul>
      )}
      {cursor !== null && (
        <Button variant="ghost" onClick={() => void more()}>
          Voir plus de clans
        </Button>
      )}
    </section>
  );
}

/** Enters the clan, asks to, or takes the request back. */
export function JoinButton({
  clan,
  join,
}: {
  readonly clan: ClanSummary;
  readonly join: ClanJoin;
}) {
  if (join.requests.includes(clan.id)) {
    return (
      <Button
        small
        variant="ghost"
        disabled={join.busy !== null}
        onClick={() => void join.withdraw(clan.id)}
      >
        Retirer ma demande
      </Button>
    );
  }
  return (
    <Button
      small
      variant={clan.entryMode === "open" ? "primary" : "secondary"}
      disabled={join.busy !== null || clan.entryMode === "invite"}
      onClick={() => void join.join(clan.id)}
    >
      {joinLabel(clan.entryMode, false)}
    </Button>
  );
}

"use client";

import type { Board, BoardEntry, BoardResponse, LeagueResponse } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import {
  BOARDS,
  boardNote,
  CLASSEMENT,
  divisionNumeral,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  leagueClaimedToast,
  leagueClaimRefusalText,
  meOutsidePage,
  playerName,
  ROAD_RULE,
  ROAD_TITLE,
  ratingLine,
  roadStops,
  SEASON_END_KICKER,
  SEASON_RULE,
  seasonRecord,
  seasonRewardLines,
  waitingReward,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { wallet } from "@/player/player";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { useToast } from "@/ui/toast";
import { Lettering, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./jousts.module.css";
import { LeagueHeader, Shield } from "./league-pieces";
import { rise } from "./pieces";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly league: LeagueResponse };

/** The leagues: where the player stands, the road of the season, its rewards and the boards. */
export function LeagueScreen() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const load = useCallback(() => {
    api
      .fetchJoustLeague()
      .then((league) => setLoaded({ state: "ready", league }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  if (loaded.state === "failed") {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={load} />
      </main>
    );
  }
  if (loaded.state === "loading") return <main className={styles.page} />;
  const { league } = loaded;
  const today = gameDayOf(Date.now()).key;
  return (
    <main className={styles.page}>
      <Link href="/joutes" className={styles.back}>
        Retour aux joutes
      </Link>
      <div className={styles.leagues}>
        <section className={`${ui.leaf} ${styles.roadLeaf} ${desk.rising}`} style={rise(0)}>
          <LeagueHeader standing={league.standing} today={today} />
          <ClaimBox league={league} onClaimed={load} />
          <Road league={league} />
        </section>
        <Boards league={league} />
        <section className={`${ui.leaf} ${styles.boardLeaf} ${desk.rising}`} style={rise(2)}>
          <span className={desk.leafKicker}>Tes joutes classées</span>
          <div className={styles.figures}>
            <p className={styles.line}>{seasonRecord(league.stats)}</p>
            <p className={styles.trapsText}>{ratingLine(league.stats)}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

/** The oldest reward waiting, with its button. */
function ClaimBox({
  league,
  onClaimed,
}: {
  readonly league: LeagueResponse;
  readonly onClaimed: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const next = waitingReward(league);
  if (next === null) return null;

  const claim = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const result = await api.claimLeagueReward(next.season, next.step);
      if (result.kind === "refused") {
        setRefusal(leagueClaimRefusalText(result.reason));
        return;
      }
      wallet.publish(result.wallet);
      toast(leagueClaimedToast(result.rewards));
      onClaimed();
    } catch {
      setRefusal("La récompense n'a pas été prise. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.claim}>
      <span className={styles.claimText}>
        <ToyIcon name={next.icon === "ecu" ? "ecu" : "sachet"} size={26} />
        <span>
          {next.title}
          {next.more !== null && <span className={styles.claimMore}>{next.more}</span>}
        </span>
      </span>
      <Button onClick={() => void claim()} disabled={busy}>
        {busy ? LEAGUE_CLAIM_BUSY : LEAGUE_CLAIM}
      </Button>
      {refusal !== null && (
        <p className={styles.notice} role="alert">
          {refusal}
        </p>
      )}
    </div>
  );
}

function Road({ league }: { readonly league: LeagueResponse }) {
  const road = useRef<HTMLOListElement>(null);
  const stops = roadStops(league);
  useEffect(() => {
    const here = road.current?.querySelector<HTMLElement>("[data-here]");
    const tray = road.current;
    if (here == null || tray == null) return;
    // Scrolls the tray only, never the page.
    tray.scrollLeft = here.offsetLeft - tray.clientWidth / 2 + here.clientWidth / 2;
  }, []);
  return (
    <>
      <Lettering className={styles.homeTitle}>{ROAD_TITLE}</Lettering>
      <ol className={styles.road} ref={road}>
        {stops.map((stop) => (
          <li
            key={stop.key}
            className={styles.roadStop}
            data-reached={stop.reached || undefined}
            data-here={stop.here || undefined}
            data-status={stop.status}
            aria-label={stop.label}
          >
            <Shield league={stop.league} numeral={stop.numeral} size={stop.here ? 54 : 40} />
            <span className={styles.roadName}>{stop.name}</span>
            <span className={styles.roadFrom}>{stop.from}</span>
            <span className={styles.roadReward}>
              {stop.short === null ? (
                "Départ"
              ) : (
                <>
                  <ToyIcon name={stop.icon === "ecu" ? "ecu" : "sachet"} size={18} />
                  {stop.short}
                </>
              )}
              {stop.status === "claimed" && <Icon name="check" size={12} />}
            </span>
            {stop.here && <span className={styles.you}>{league.standing.laurels}</span>}
          </li>
        ))}
      </ol>
      <p className={styles.trapsText}>{ROAD_RULE}</p>
      <div className={styles.endRewards}>
        <span className={desk.leafKicker}>{SEASON_END_KICKER}</span>
        <ul>
          {seasonRewardLines(league).map((line) => (
            <li key={line.league} data-here={line.here || undefined}>
              <Shield
                league={line.league}
                numeral={line.league === "champion" ? null : "I"}
                size={26}
              />
              <strong>{line.name}</strong>
              <span>{line.reward}</span>
            </li>
          ))}
        </ul>
        <p className={styles.trapsText}>{SEASON_RULE}</p>
      </div>
    </>
  );
}

type BoardState =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly board: BoardResponse; readonly more: boolean };

function Boards({ league }: { readonly league: LeagueResponse }) {
  const [tab, setTab] = useState<Board>("league");
  const [shown, setShown] = useState<BoardState>({ state: "loading" });
  const tabs = BOARDS.filter((entry) => entry.id !== "general" || league.generalOpen);

  const load = useCallback((board: Board) => {
    setShown({ state: "loading" });
    api
      .fetchJoustBoard(board)
      .then((page) => setShown({ state: "ready", board: page, more: false }))
      .catch(() => setShown({ state: "failed" }));
  }, []);
  useEffect(() => load(tab), [load, tab]);

  const more = async () => {
    if (shown.state !== "ready" || shown.board.next === null) return;
    setShown({ ...shown, more: true });
    try {
      const page = await api.fetchJoustBoard(shown.board.board, shown.board.next);
      setShown({
        state: "ready",
        more: false,
        board: { ...page, entries: [...shown.board.entries, ...page.entries] },
      });
    } catch {
      setShown({ ...shown, more: false });
    }
  };

  return (
    <section className={`${ui.leaf} ${styles.boardLeaf} ${desk.rising}`} style={rise(1)}>
      <header className={styles.boardHead}>
        <Lettering className={styles.homeTitle}>{CLASSEMENT}</Lettering>
        <div className={styles.tabs} role="tablist" aria-label={CLASSEMENT}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === tab}
              className={styles.tab}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>
      {shown.state === "failed" && <LoadFailed onRetry={() => load(tab)} />}
      {shown.state === "ready" && (
        <>
          <ol className={styles.standings}>
            {shown.board.entries.map((entry) => (
              <Standing
                key={entry.player.code}
                entry={entry}
                me={entry.player.code === shown.board.me.player.code}
              />
            ))}
            {meOutsidePage(shown.board) && <Standing entry={shown.board.me} me pinned />}
          </ol>
          {shown.board.next !== null && (
            <div className={styles.more}>
              <MainAction
                label={shown.more ? "Chargement…" : "Voir la suite"}
                disabled={shown.more}
                onClick={() => void more()}
              />
            </div>
          )}
          <p className={styles.trapsText}>{boardNote(shown.board)}</p>
        </>
      )}
    </section>
  );
}

function Standing({
  entry,
  me,
  pinned = false,
}: {
  readonly entry: BoardEntry;
  readonly me: boolean;
  readonly pinned?: boolean;
}) {
  const name = playerName(entry.player);
  return (
    <li className={styles.standing} data-me={me || undefined} data-pinned={pinned || undefined}>
      <span className={styles.place} data-podium={entry.place <= 3 || undefined}>
        {entry.place}
      </span>
      <Avatar avatar={entry.player.avatar} frame={entry.player.frame} size={36} />
      <span className={styles.standingName}>
        {me ? `${name} (toi)` : name}
        {entry.champion && <span className={styles.emblem}>Champion</span>}
      </span>
      <Shield league={entry.division.league} numeral={divisionNumeral(entry.division)} size={24} />
      <span className={styles.standingLauriers}>{entry.laurels}</span>
    </li>
  );
}

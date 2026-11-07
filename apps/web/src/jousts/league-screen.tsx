"use client";

import type { Board, BoardResponse, LeagueResponse } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import {
  AUTOMATON,
  BOARDS,
  type BoardLine,
  boardLines,
  boardNote,
  CLASSEMENT,
  LADDER_TITLE,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  ladderRules,
  ladderSteps,
  leagueClaimedToast,
  leagueClaimRefusalText,
  ratingLine,
  waitingReward,
  weekRecord,
  ZONE_DOWN,
  ZONE_UP,
  zoneStarts,
} from "@leximon/view-model";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
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

/** The leagues: where the player stands this week, the rewards to claim, the boards, the ladder. */
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
        </section>
        <Boards league={league} />
        <section className={`${ui.leaf} ${styles.roadLeaf} ${desk.rising}`} style={rise(2)}>
          <Ladder league={league} />
        </section>
        <section className={`${ui.leaf} ${styles.boardLeaf} ${desk.rising}`} style={rise(3)}>
          <span className={desk.leafKicker}>Tes joutes classées</span>
          <div className={styles.figures}>
            <p className={styles.line}>{weekRecord(league.stats)}</p>
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
      const result = await api.claimLeagueReward(next.week);
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
          <span className={styles.claimMore}>{next.detail}</span>
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

/** The seven leagues, highest first, with what each week in them gives. */
function Ladder({ league }: { readonly league: LeagueResponse }) {
  return (
    <>
      <Lettering className={styles.homeTitle}>{LADDER_TITLE}</Lettering>
      <ol className={styles.ladder}>
        {ladderSteps(league).map((step) => (
          <li
            key={step.league}
            className={styles.ladderStep}
            data-here={step.here || undefined}
            aria-label={step.label}
          >
            <Shield league={step.league} size={step.here ? 40 : 30} />
            <strong>{step.name}</strong>
            <span className={styles.ladderMoves}>{step.moves}</span>
            <span className={styles.ladderReward}>
              <ToyIcon name="ecu" size={18} /> {step.reward}
            </span>
          </li>
        ))}
      </ol>
      <ul className={styles.ladderRules}>
        {ladderRules(league).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}

type BoardState =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly board: BoardResponse; readonly more: boolean };

function Boards({ league }: { readonly league: LeagueResponse }) {
  const [tab, setTab] = useState<Board>("group");
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
          <Standings board={shown.board} />
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

/** A board's lines; in the group, the zones that go up and down are marked. */
function Standings({ board }: { readonly board: BoardResponse }) {
  const { lines, pinned } = boardLines(board);
  if (lines.length === 0 && pinned === null) return null;
  const zones = board.board === "group" ? zoneStarts(lines) : { stay: null, down: null };
  const ups = board.board === "group" && lines[0]?.move === "up";
  return (
    <ol className={styles.standings}>
      {ups && <li className={styles.zone}>{ZONE_UP}</li>}
      {lines.map((line) => (
        <Fragment key={line.key}>
          {line.key === zones.stay && <li className={styles.zoneEnd} aria-hidden="true" />}
          {line.key === zones.down && (
            <li className={styles.zone} data-move="down">
              {ZONE_DOWN}
            </li>
          )}
          <Standing line={line} />
        </Fragment>
      ))}
      {pinned !== null && <Standing line={pinned} pinned />}
    </ol>
  );
}

function Standing({
  line,
  pinned = false,
}: {
  readonly line: BoardLine;
  readonly pinned?: boolean;
}) {
  return (
    <li
      className={styles.standing}
      data-me={line.me || undefined}
      data-pinned={pinned || undefined}
      data-move={line.move ?? undefined}
      data-kind={line.kind}
    >
      <span className={styles.place} data-podium={line.podium || undefined}>
        {line.place}
      </span>
      {line.player !== null ? (
        <Avatar avatar={line.player.avatar} frame={line.player.frame} size={36} />
      ) : (
        <span className={styles.automaton} aria-hidden="true">
          <Icon name={line.kind === "bot" ? "reglages" : "profil"} size={20} />
        </span>
      )}
      <span className={styles.standingName}>
        {line.name}
        {line.tag !== null && <span className={styles.botTag}>{AUTOMATON}</span>}
        {line.champion && <span className={styles.emblem}>Champion</span>}
      </span>
      <Shield league={line.league} size={24} />
      <span className={styles.standingPoints}>{line.points}</span>
    </li>
  );
}

"use client";

import type { Board, BoardResponse, LeagueResponse } from "@leximon/contract";
import {
  AUTOMATON,
  BOARDS,
  type BoardLine,
  boardLines,
  boardNote,
  CLASSEMENT,
  CLIMB_KICKER,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  LEAGUE_NAMES,
  leagueClaimedToast,
  leagueClaimRefusalText,
  leagueClimb,
  MY_GROUP,
  ratingLine,
  waitingReward,
  weekRecord,
  ZONE_DOWN,
  ZONE_UP,
  zoneStarts,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, Fragment, useCallback, useEffect, useState } from "react";
import { play } from "@/booster/feedback";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { MainAction } from "@/library/play-pieces";
import { wallet } from "@/player/player";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { BindingRule } from "@/ui/ornaments";
import { ParticleStage } from "@/ui/stage";
import { useToast } from "@/ui/toast";
import { ToyIcon } from "@/ui/toy";
import { ClimbScene } from "./climb-scene";
import { Crest } from "./crest";
import { Leagues, Road } from "./hall";
import hall from "./hall.module.css";
import styles from "./jousts.module.css";
import { rise } from "./pieces";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly league: LeagueResponse };

/**
 * The leagues: a league climbed plays its scene first, then the road of the seven leagues, the
 * week's boards with the group's zones, and the player's figures.
 */
export function LeagueScreen() {
  return (
    <ParticleStage>
      <LeagueFlow />
    </ParticleStage>
  );
}

function LeagueFlow() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [leaguesOpen, setLeaguesOpen] = useState(false);
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
  let order = 0;
  return (
    <main className={styles.page}>
      <Link href="/joutes" className={styles.back}>
        Retour aux joutes
      </Link>
      <div className={hall.hall}>
        <h1 className={hall.title}>{CLASSEMENT}</h1>
        <Claim league={league} onClaimed={load} style={rise(order++)} />
        <Road
          standing={league.standing}
          league={league}
          onOpen={() => setLeaguesOpen(true)}
          style={rise(order++)}
        />
        <Boards league={league} style={rise(order++)} />
        <section className={hall.leaf} style={rise(order++)}>
          <BindingRule />
          <span className={hall.kicker}>Tes joutes classées</span>
          <p className={styles.line}>{weekRecord(league.stats)}</p>
          <p className={hall.leafText}>{ratingLine(league.stats)}</p>
        </section>
      </div>
      <Dialog
        open={leaguesOpen}
        title="Les ligues"
        variant="center"
        size="medium"
        onClose={() => setLeaguesOpen(false)}
      >
        <Leagues league={league} />
      </Dialog>
    </main>
  );
}

/** The oldest reward waiting: the scene of a league climbed, or its leaf with the button. */
function Claim({
  league,
  onClaimed,
  style,
}: {
  readonly league: LeagueResponse;
  readonly onClaimed: () => void;
  readonly style: CSSProperties;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const next = waitingReward(league);
  const climb = leagueClimb(league);
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
      play("coins");
      toast(leagueClaimedToast(result.rewards));
      onClaimed();
    } catch {
      setRefusal("La récompense n'a pas été prise. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  if (climb !== null) {
    return (
      <div style={style}>
        <ClimbScene
          key={climb.week}
          climb={climb}
          busy={busy}
          refusal={refusal}
          onClaim={() => void claim()}
        />
      </div>
    );
  }
  return (
    <section className={hall.leaf} style={style}>
      <BindingRule />
      <span className={hall.kicker}>{CLIMB_KICKER}</span>
      <div className={styles.claim}>
        <span className={styles.claimText}>
          <ToyIcon name={next.icon === "ecu" ? "ecu" : "sachet"} size={34} />
          <span>
            {next.title}
            <span className={styles.claimMore}>{next.detail}</span>
            {next.more !== null && <span className={styles.claimMore}>{next.more}</span>}
          </span>
        </span>
        <MainAction
          label={busy ? LEAGUE_CLAIM_BUSY : LEAGUE_CLAIM}
          disabled={busy}
          onClick={() => void claim()}
        />
        {refusal !== null && (
          <p className={styles.notice} role="alert">
            {refusal}
          </p>
        )}
      </div>
    </section>
  );
}

type BoardState =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly board: BoardResponse; readonly more: boolean };

function Boards({
  league,
  style,
}: {
  readonly league: LeagueResponse;
  readonly style: CSSProperties;
}) {
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
    <section className={hall.leaf} style={style}>
      <BindingRule />
      <header className={styles.boardHead}>
        <span className={hall.kicker}>
          {shown.state === "ready" && shown.board.league !== null
            ? `${MY_GROUP} · ${LEAGUE_NAMES[shown.board.league]}`
            : CLASSEMENT}
        </span>
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
          <p className={hall.leafText}>{boardNote(shown.board)}</p>
        </>
      )}
    </section>
  );
}

/**
 * A board's lines. In the group, as in Duolingo: the zones that go up and down in their colour, a
 * line where each ends, and the player's own line kept in sight while the list scrolls.
 */
function Standings({ board }: { readonly board: BoardResponse }) {
  const { lines, pinned } = boardLines(board);
  if (lines.length === 0 && pinned === null) return null;
  const group = board.board === "group";
  const zones = group ? zoneStarts(lines) : { stay: null, down: null };
  return (
    <ol className={`${hall.rows} ${styles.groupBoard}`}>
      {lines.map((line) => (
        <Fragment key={line.key}>
          {line.key === zones.stay && (
            <li className={hall.zoneLine} data-move="up">
              <Icon name="chev" size={12} className={hall.up} /> {ZONE_UP}
            </li>
          )}
          {line.key === zones.down && (
            <li className={hall.zoneLine} data-move="down">
              {ZONE_DOWN}
            </li>
          )}
          <Standing line={line} zoned={group} />
        </Fragment>
      ))}
      {pinned !== null && <Standing line={pinned} zoned={group} />}
    </ol>
  );
}

function Standing({ line, zoned }: { readonly line: BoardLine; readonly zoned: boolean }) {
  return (
    <li
      className={`${hall.row} ${styles.groupRow}`}
      data-me={line.me || undefined}
      data-move={zoned ? (line.move ?? undefined) : undefined}
    >
      <span className={hall.rowPlace} data-podium={line.podium || undefined}>
        {line.place}
      </span>
      {line.player !== null ? (
        <Avatar avatar={line.player.avatar} frame={line.player.frame} size={34} />
      ) : (
        <span className={hall.automaton} aria-hidden="true">
          <Icon name={line.kind === "bot" ? "reglages" : "profil"} size={18} />
        </span>
      )}
      <span className={hall.rowName}>
        {line.name}
        {line.tag !== null && <span className={hall.botTag}>{AUTOMATON}</span>}
        {line.champion && <span className={styles.emblem}>Champion</span>}
      </span>
      {!zoned && <Crest league={line.league} size={26} />}
      <span className={hall.rowPoints}>{line.points} pts</span>
    </li>
  );
}

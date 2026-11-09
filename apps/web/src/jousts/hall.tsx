"use client";

import type {
  BoardResponse,
  JoustDeckResponse,
  JoustStanding,
  JoustSummary,
  JoustsResponse,
  JoustView,
  LeagueResponse,
} from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import {
  AUTOMATON,
  type BoardLine,
  CLASSEMENT,
  COMPOSE_DECK,
  DECK_NOT_SAVED,
  deckPointsLine,
  deckTrapsLine,
  EDIT_DECK_SHORT,
  ENDED_IN_VIEW,
  GUIDE_AGAIN,
  groupGlimpse,
  HOW_FOLD,
  HOW_TITLE,
  howOpenAtFirst,
  howSteps,
  JOUST,
  JOUSTS_HELP_LABEL,
  JOUSTS_TITLE,
  joustRowState,
  joustSections,
  LAUNCH_FREE,
  LAUNCH_FRIENDLY,
  LEAGUE_NAMES,
  LEAGUE_ROAD,
  LETTER_DETAIL,
  ladderRules,
  ladderSteps,
  launchRefusalText,
  leagueRoad,
  MY_GROUP,
  NO_JOUSTS,
  OPEN_LETTER,
  openedLetter,
  outcomeWord,
  PLAY_JOUST,
  playerName,
  rankedLances,
  rankedLeftText,
  roadLabel,
  runSize,
  SEE_LEAGUES,
  sealedLine,
  seeAllEndedText,
  standingHeader,
  waitingTokenLine,
  weekFigures,
  weekRewardLine,
  YOU,
  zoneChip,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, Fragment, type ReactNode, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { useEngravingInk } from "@/cards/use-engraving-ink";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { MainAction } from "@/library/play-pieces";
import { useShell } from "@/shell/shell-context";
import { catalogCard } from "@/trades/card-thumb";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { Lettering, Toy, ToyIcon } from "@/ui/toy";
import { Crest } from "./crest";
import { DeckBuilder } from "./deck-builder";
import styles from "./hall.module.css";
import { MiniCard, rise } from "./pieces";

/** The letter turns over in this time; the seal's sound and the outcome's meet in the middle. */
const FLIP_MS = 640;

/** The old print behind the lice: a rider at full gallop, from the card of the same name. */
const LICE_ENGRAVING = "palefroi";

type Launch = Parameters<typeof api.launchJoust>[0];

/**
 * The jousts' hall, from top to bottom: the lice (league, week, launch), the road of the leagues,
 * the player's neighbours in the group, how it works, their jousts, their deck.
 */
export function Hall({
  jousts,
  deck,
  league,
  group,
  busy,
  refusal,
  onLaunch,
  onFriends,
  onGuide,
  onDeckSaved,
}: {
  readonly jousts: JoustsResponse;
  readonly deck: JoustDeckResponse;
  /** The ladder and the player's figures, `null` while they load. */
  readonly league: LeagueResponse | null;
  /** The week's group, `null` while it loads or when the player has not entered it. */
  readonly group: BoardResponse | null;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onLaunch: (request: Launch) => void;
  readonly onFriends: () => void;
  readonly onGuide: () => void;
  readonly onDeckSaved: () => void;
}) {
  const now = useNow(60_000) || Date.now();
  const [deckOpen, setDeckOpen] = useState(false);
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [howChoice, setHowChoice] = useState<boolean | null>(null);
  const howOpen = howChoice ?? (league === null ? false : howOpenAtFirst(league.stats.ranked));
  const glimpse = group === null ? null : groupGlimpse(group);
  let order = 0;

  return (
    <div className={styles.hall}>
      <h1 className={styles.title}>{JOUSTS_TITLE}</h1>
      <Lice
        standing={jousts.standing}
        league={league}
        now={now}
        style={rise(order++)}
        help={
          <Toy
            matter="paper"
            shape="round"
            className={styles.help}
            aria-label={JOUSTS_HELP_LABEL}
            aria-expanded={howOpen}
            onClick={() => setHowChoice(!howOpen)}
          >
            <Icon name="help" size={20} />
          </Toy>
        }
      >
        <LiceActions
          jousts={jousts}
          busy={busy}
          refusal={refusal}
          onLaunch={onLaunch}
          onFriends={onFriends}
          onCompose={() => setDeckOpen(true)}
        />
      </Lice>

      {jousts.deckSaved && (
        <DeckLeaf deck={deck} onEdit={() => setDeckOpen(true)} style={rise(order++)} />
      )}

      <Road
        standing={jousts.standing}
        league={league}
        onOpen={() => setLeaguesOpen(true)}
        style={rise(order++)}
      />

      {glimpse !== null && (
        <section className={styles.leaf} style={rise(order++)}>
          <header className={styles.leafHead}>
            <span className={styles.kicker}>
              {MY_GROUP} · {LEAGUE_NAMES[jousts.standing.league]}
            </span>
            <Link href="/joutes/classement" className={styles.more}>
              {CLASSEMENT} <Icon name="chev" size={14} />
            </Link>
          </header>
          <ol className={styles.rows}>
            {glimpse.lines.map((line) => (
              <Fragment key={line.key}>
                {glimpse.downFrom?.key === line.key && (
                  <li className={styles.zoneLine} data-move="down">
                    {glimpse.downFrom.text}
                  </li>
                )}
                <GroupRow line={line} />
                {glimpse.upAfter?.key === line.key && (
                  <li className={styles.zoneLine} data-move="up">
                    <Icon name="chev" size={12} className={styles.up} /> {glimpse.upAfter.text}
                  </li>
                )}
              </Fragment>
            ))}
          </ol>
        </section>
      )}

      {howOpen && (
        <section className={styles.leaf} style={rise(order++)}>
          <header className={styles.leafHead}>
            <span className={styles.kicker}>{HOW_TITLE}</span>
            <button type="button" className={styles.more} onClick={() => setHowChoice(false)}>
              {HOW_FOLD}
            </button>
          </header>
          <ol className={styles.steps}>
            {howSteps(runSize(now), league?.points.won ?? null).map((step) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepIcon}>
                  <ToyIcon name={step.icon} size={40} />
                </span>
                <span className={styles.stepText}>
                  <b>{step.title}</b>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className={styles.guide} onClick={onGuide}>
            {GUIDE_AGAIN}
          </button>
        </section>
      )}

      <JoustLists jousts={jousts.jousts} now={now} style={rise(order++)} />

      <Dialog
        open={deckOpen}
        title="Ton deck"
        variant="center"
        size="xlarge"
        onClose={() => setDeckOpen(false)}
      >
        {deckOpen && (
          <DeckBuilder
            deck={deck}
            initial={deck.saved || jousts.jousts.length > 0 ? deck.cardIds : []}
            onSaved={() => {
              setDeckOpen(false);
              onDeckSaved();
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={leaguesOpen}
        title="Les ligues"
        variant="center"
        size="medium"
        onClose={() => setLeaguesOpen(false)}
      >
        {league !== null && <Leagues league={league} />}
      </Dialog>
    </div>
  );
}

// --- The lice ------------------------------------------------------------------------------------

function Lice({
  standing,
  league,
  now,
  style,
  help,
  children,
}: {
  readonly standing: JoustStanding;
  readonly league: LeagueResponse | null;
  readonly now: number;
  readonly style: CSSProperties;
  readonly help: ReactNode;
  readonly children: ReactNode;
}) {
  const header = standingHeader(standing, gameDayOf(now).key);
  const reward = weekRewardLine(standing.league, league?.ladder ?? null);
  const engraving = useEngravingInk(LICE_ENGRAVING);
  const figures = standing.group === null ? null : weekFigures(standing.group);
  return (
    <section className={styles.lice} style={style}>
      {engraving !== null && (
        <span
          className={styles.engraving}
          style={{ "--ink": `url("${engraving}")` } as CSSProperties}
          aria-hidden="true"
        />
      )}
      <span className={styles.helpSlot}>{help}</span>
      <div className={styles.liceCrest}>
        <span className={styles.crestGlow} aria-hidden="true" />
        <Crest league={standing.league} size={150} />
        <Lettering className={styles.ribbon}>{header.name}</Lettering>
      </div>

      <div className={styles.week}>
        <span className={styles.kickerLight}>Tournoi de la semaine</span>
        {figures !== null && standing.group !== null && (
          <div className={styles.figures}>
            <Lettering className={styles.figure}>
              {figures.place} <small>{figures.of}</small>
            </Lettering>
            <Lettering className={styles.figure}>
              {figures.points} <small>{figures.pointsWord}</small>
            </Lettering>
            <span className={styles.zone} data-move={standing.group.move}>
              {standing.group.move !== "stay" && (
                <Icon name="chev" size={14} className={styles[standing.group.move]} />
              )}
              {zoneChip(standing.group.move)}
            </span>
          </div>
        )}
        <p className={styles.weekLine}>{header.line}</p>
        {reward !== null && <p className={styles.weekReward}>{reward}</p>}
        <span className={styles.clock}>
          <Icon name="clock" size={16} /> {header.week}
        </span>
        <div className={styles.lances}>
          {rankedLances(standing.rankedLeft, standing.rankedPerDay).map((standingUp, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the day's lances, in order
            <Lance key={index} spent={!standingUp} />
          ))}
          <span className={styles.lancesText}>{rankedLeftText(standing.rankedLeft)}</span>
        </div>
        {header.waiting !== null && (
          <Link href="/joutes/classement" className={styles.waiting}>
            <ToyIcon name="chest" size={22} /> {header.waiting}
          </Link>
        )}
      </div>

      <div className={styles.actions}>{children}</div>
    </section>
  );
}

function LiceActions({
  jousts,
  busy,
  refusal,
  onLaunch,
  onFriends,
  onCompose,
}: {
  readonly jousts: JoustsResponse;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onLaunch: (request: Launch) => void;
  readonly onFriends: () => void;
  readonly onCompose: () => void;
}) {
  const ready = jousts.deckSaved && jousts.deckReady;
  const ranked = jousts.standing.rankedLeft > 0;
  return (
    <>
      {ready ? (
        <>
          <MainAction
            label={ranked ? JOUST : LAUNCH_FREE}
            disabled={busy}
            onClick={() => onLaunch({ kind: ranked ? "ranked" : "free" })}
          />
          <div className={styles.minorActions}>
            {ranked && (
              <Toy
                matter="paper"
                className={styles.minor}
                disabled={busy}
                onClick={() => onLaunch({ kind: "free" })}
              >
                <Icon name="swap" size={18} /> {LAUNCH_FREE}
              </Toy>
            )}
            <Toy matter="paper" className={styles.minor} disabled={busy} onClick={onFriends}>
              <Icon name="amis" size={18} /> {LAUNCH_FRIENDLY}
            </Toy>
          </div>
        </>
      ) : (
        <MainAction label={COMPOSE_DECK} disabled={!jousts.deckReady} onClick={onCompose} />
      )}
      {!jousts.deckReady && (
        <p className={styles.actionLine}>{launchRefusalText("deck_too_small", 0)}</p>
      )}
      {jousts.deckReady && !jousts.deckSaved && (
        <p className={styles.actionLine}>{DECK_NOT_SAVED}</p>
      )}
      {refusal !== null && (
        <p className={styles.notice} role="alert">
          {refusal}
        </p>
      )}
    </>
  );
}

/** A ranked joust of the day: standing while still to play, laid down once played. */
function Lance({ spent }: { readonly spent: boolean }) {
  return (
    <svg
      className={styles.lance}
      data-spent={spent || undefined}
      viewBox="0 0 14 44"
      aria-hidden="true"
    >
      <path d="M7 1 L11 12 H3 Z" />
      <path d="M5.5 12 H8.5 L9 34 H5 Z" />
      <path d="M2 34 H12 L10 40 H4 Z" />
    </svg>
  );
}

// --- The road of the leagues ---------------------------------------------------------------------

export function Road({
  standing,
  league,
  onOpen,
  style,
}: {
  readonly standing: JoustStanding;
  readonly league: LeagueResponse | null;
  readonly onOpen: () => void;
  readonly style: CSSProperties;
}) {
  const narrow = useNarrow();
  const stops = leagueRoad(standing.league);
  const here = stops.findIndex((stop) => stop.state === "here");
  return (
    <section className={styles.leaf} style={style}>
      <header className={styles.leafHead}>
        <span className={styles.kicker}>{LEAGUE_ROAD}</span>
        <button type="button" className={styles.more} disabled={league === null} onClick={onOpen}>
          {SEE_LEAGUES} <Icon name="chev" size={14} />
        </button>
      </header>
      <button
        type="button"
        className={styles.road}
        aria-label={`${roadLabel(standing.league)} ${SEE_LEAGUES}`}
        disabled={league === null}
        onClick={onOpen}
        style={{ "--reached": here / (stops.length - 1) } as CSSProperties}
      >
        <span className={styles.roadLine} aria-hidden="true" />
        {stops.map((stop) => (
          <span key={stop.league} className={styles.stop} data-state={stop.state}>
            {stop.state === "here" && <span className={styles.youTag}>{YOU}</span>}
            <Crest
              league={stop.league}
              size={stop.state === "here" ? (narrow ? 50 : 62) : narrow ? 38 : 46}
              dim={stop.state === "ahead"}
            />
            <span className={styles.stopName}>{stop.name}</span>
          </span>
        ))}
      </button>
    </section>
  );
}

export function Leagues({ league }: { readonly league: LeagueResponse }) {
  return (
    <div className={styles.leagues}>
      <ol className={styles.ladder}>
        {ladderSteps(league).map((step) => (
          <li
            key={step.league}
            className={styles.ladderRow}
            data-here={step.here || undefined}
            aria-label={step.label}
          >
            <Crest league={step.league} size={52} />
            <span className={styles.ladderText}>
              <b>
                {step.name}
                {step.here && <span className={styles.youInline}>{YOU}</span>}
              </b>
              <small>{step.moves}</small>
              <small>{step.reward}</small>
            </span>
          </li>
        ))}
      </ol>
      <ul className={styles.rules}>
        {ladderRules(league).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

// --- The group -----------------------------------------------------------------------------------

function GroupRow({ line }: { readonly line: BoardLine }) {
  return (
    <li className={styles.row} data-me={line.me || undefined}>
      <span className={styles.rowPlace}>{line.place}</span>
      {line.player !== null ? (
        <Avatar avatar={line.player.avatar} frame={line.player.frame} size={34} />
      ) : (
        <span className={styles.automaton} aria-hidden="true">
          <Icon name={line.kind === "bot" ? "reglages" : "profil"} size={18} />
        </span>
      )}
      <span className={styles.rowName}>
        {line.name}
        {line.tag !== null && <span className={styles.botTag}>{AUTOMATON}</span>}
      </span>
      <span className={styles.rowPoints}>{line.points} pts</span>
    </li>
  );
}

// --- The jousts ----------------------------------------------------------------------------------

function JoustLists({
  jousts,
  now,
  style,
}: {
  readonly jousts: readonly JoustSummary[];
  readonly now: number;
  readonly style: CSSProperties;
}) {
  const sections = joustSections(jousts);
  const [allEnded, setAllEnded] = useState(false);
  return (
    <section className={styles.leaf} style={style}>
      {jousts.length === 0 && <p className={styles.leafText}>{NO_JOUSTS}</p>}
      {sections.toPlay.length > 0 && (
        <Group title="À toi de jouer">
          {sections.toPlay.map((joust) => (
            <JoustRow key={joust.id} joust={joust} now={now} toPlay>
              <span className={styles.play}>{PLAY_JOUST}</span>
            </JoustRow>
          ))}
        </Group>
      )}
      {sections.toDiscover.length > 0 && (
        <Group title="Résultats à découvrir">
          <div className={styles.letters}>
            {sections.toDiscover.map((joust) => (
              <Letter key={joust.id} joust={joust} />
            ))}
          </div>
        </Group>
      )}
      {sections.waiting.length > 0 && (
        <Group title="En attente">
          <div className={styles.tokens}>
            {sections.waiting.map((joust) => (
              <WaitingToken key={joust.id} joust={joust} now={now} />
            ))}
          </div>
        </Group>
      )}
      {sections.ended.length > 0 && (
        <Group title="Terminées">
          <div className={styles.ended}>
            {(allEnded ? sections.ended : sections.ended.slice(0, ENDED_IN_VIEW)).map((joust) => (
              <EndedRow key={joust.id} joust={joust} now={now} />
            ))}
          </div>
          {!allEnded && sections.ended.length > ENDED_IN_VIEW && (
            <button type="button" className={styles.more} onClick={() => setAllEnded(true)}>
              {seeAllEndedText(sections.ended.length)} <Icon name="chev" size={14} />
            </button>
          )}
        </Group>
      )}
    </section>
  );
}

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.kicker}>{title}</span>
      {children}
    </div>
  );
}

/** A result to discover: a letter under a wax seal, the opponent's portrait in the wax. */
/**
 * A result to discover: a letter under a wax seal, the opponent's portrait in the wax. Opened, it
 * turns over where it lies and shows the result; the gains follow once the server sends them.
 */
function Letter({ joust }: { readonly joust: JoustSummary }) {
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<JoustView["result"] | null>(null);
  const back = openedLetter(joust, result);
  const name = playerName(joust.opponent);

  const open = () => {
    if (opened) return;
    setOpened(true);
    play("sealBreak");
    window.setTimeout(() => {
      play(joust.outcome === "won" ? "fanfareEpic" : "flip");
      vibrate(joust.outcome === "won" ? [30, 40, 60] : [30]);
    }, FLIP_MS / 2);
    // Watched once: the seal stays broken on every device.
    api.markJoustSeen(joust.id).catch(() => undefined);
    api
      .fetchJoust(joust.id)
      .then((view) => setResult(view.result))
      .catch(() => undefined);
  };

  return (
    <div className={styles.letter} data-opened={opened || undefined}>
      <div className={styles.letterInner}>
        <button
          type="button"
          className={`${styles.letterFace} ${styles.letterFront}`}
          onClick={open}
          aria-label={`${name}. ${sealedLine(joust)}`}
          inert={opened}
        >
          <span className={styles.letterFlap} aria-hidden="true" />
          <span className={styles.seal}>
            <Avatar
              avatar={joust.opponent?.avatar ?? null}
              frame={joust.opponent?.frame ?? null}
              size={46}
            />
          </span>
          <span className={styles.letterText}>
            <b>{name}</b>
            <small>{sealedLine(joust)}</small>
          </span>
          <span className={styles.letterGo}>{OPEN_LETTER}</span>
        </button>
        <div
          className={`${styles.letterFace} ${styles.letterBack}`}
          data-outcome={joust.outcome ?? "draw"}
          aria-live="polite"
          inert={!opened}
        >
          <Lettering className={styles.letterOutcome}>{back.outcome}</Lettering>
          <span className={styles.letterScore}>
            <b>{name}</b> · {back.score}
          </span>
          {back.gains.length > 0 && (
            <span className={styles.letterGains}>
              {back.gains.map((gain) => (
                <span key={gain} className={styles.letterGain}>
                  {gain}
                </span>
              ))}
            </span>
          )}
          <Link href={`/joutes/${joust.id}`} className={styles.letterDetail}>
            {LETTER_DETAIL}
            <Icon name="chev" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function JoustRow({
  joust,
  now,
  toPlay = false,
  children,
}: {
  readonly joust: JoustSummary;
  readonly now: number;
  readonly toPlay?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={`/joutes/${joust.id}`}
      className={styles.listRow}
      data-to-play={toPlay || undefined}
    >
      <Avatar
        avatar={joust.opponent?.avatar ?? null}
        frame={joust.opponent?.frame ?? null}
        size={38}
      />
      <b className={styles.listName}>{playerName(joust.opponent)}</b>
      <span className={styles.listState}>{joustRowState(joust, now)}</span>
      {children}
    </Link>
  );
}

/** A joust waiting on the opponent: their portrait under an hourglass, and until when. */
function WaitingToken({ joust, now }: { readonly joust: JoustSummary; readonly now: number }) {
  const name = playerName(joust.opponent);
  const line = waitingTokenLine(joust, now);
  return (
    <Link href={`/joutes/${joust.id}`} className={styles.token} aria-label={`${name}, ${line}`}>
      <span className={styles.tokenFace}>
        <Avatar
          avatar={joust.opponent?.avatar ?? null}
          frame={joust.opponent?.frame ?? null}
          size={48}
        />
        <span className={styles.tokenClock} aria-hidden="true">
          <Icon name="clock" size={14} />
        </span>
      </span>
      <b className={styles.tokenName}>{name}</b>
      <span className={styles.tokenLine}>{line}</span>
    </Link>
  );
}

/** An ended joust on one tight line, its outcome in colour down its whole right end. */
function EndedRow({ joust, now }: { readonly joust: JoustSummary; readonly now: number }) {
  return (
    <Link href={`/joutes/${joust.id}`} className={styles.endedRow}>
      <Avatar
        avatar={joust.opponent?.avatar ?? null}
        frame={joust.opponent?.frame ?? null}
        size={30}
      />
      <b className={styles.listName}>{playerName(joust.opponent)}</b>
      <span className={styles.endedState}>{joustRowState(joust, now)}</span>
      <span className={styles.outcome} data-outcome={joust.outcome ?? "draw"}>
        {outcomeWord(joust.outcome)}
      </span>
    </Link>
  );
}

// --- The deck ------------------------------------------------------------------------------------

function DeckLeaf({
  deck,
  onEdit,
  style,
}: {
  readonly deck: JoustDeckResponse;
  readonly onEdit: () => void;
  readonly style: CSSProperties;
}) {
  const catalog = useCatalog();
  const narrow = useNarrow();
  const { openCard } = useShell();
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const spent = deck.cardIds.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
  const trapsLine = deckTrapsLine(deck.trapped);
  const middle = (deck.cardIds.length - 1) / 2;
  return (
    <section className={styles.leaf} style={style}>
      <header className={styles.leafHead}>
        <span className={styles.kicker}>Ton deck</span>
        <Toy matter="paper" className={styles.minor} onClick={onEdit}>
          {EDIT_DECK_SHORT}
        </Toy>
      </header>
      <p className={styles.leafText}>
        {deckPointsLine(spent, deck.budget)}
        {trapsLine !== null && ` ${trapsLine}`}
      </p>
      {catalog !== null && (
        <div className={styles.fan}>
          {deck.cardIds.map((cardId, index) => {
            const card = catalogCard(catalog, cardId);
            return (
              <button
                key={cardId}
                type="button"
                className={styles.fanCard}
                aria-label={card.word}
                onClick={() => openCard(cardId, deck.cardIds)}
                style={
                  {
                    "--turn": `${(index - middle) * 4}deg`,
                    "--lift": `${Math.abs(index - middle) * 4}px`,
                  } as CSSProperties
                }
              >
                <MiniCard card={card} width={narrow ? 70 : 104} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

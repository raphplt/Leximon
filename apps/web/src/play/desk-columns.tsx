"use client";

import type { DailyChallengeResponse, RiddleResponse } from "@leximon/contract";
import {
  coffretsLabel,
  DESK_TEXTS,
  dailyView,
  goalRing,
  levelDescription,
  levelRatio,
  lockedToast,
  nextRewardLine,
  playFabs,
  reserveView,
  riddleAction,
  riddleNature,
  riddleProgressLine,
  riddleSlots,
  stockView,
  todayLabel,
  upcomingRewards,
  xpProgressLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { Emblem } from "@/clan/emblem";
import { SideTile } from "@/library/play-pieces";
import { myClan } from "@/player/clan";
import { dailyChallenge } from "@/player/collection";
import { useShared } from "@/player/resource";
import { todayRiddle } from "@/player/riddle";
import { REWARD_ICONS } from "@/shell/reward-icons";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level-bits";
import { Kicker, Lettering, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./desk-columns.module.css";
import play from "./play.module.css";

/** Each leaf rises in turn when the desk appears. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

/**
 * Left of the desk on a wide screen: what the day holds, the challenge, the riddle and a word of
 * the album, each on its own leaf.
 */
export function TodayColumn({ word }: { readonly word: ReactNode }) {
  const view = usePlayerView();
  const daily = useShared(dailyChallenge);
  const riddle = useShared(todayRiddle);
  // Read again each time the desk is shown: the riddle may have been played meanwhile.
  useEffect(() => todayRiddle.refresh(), []);
  if (view.now === 0) return null;
  return (
    <aside className={styles.column} aria-label={DESK_TEXTS.today}>
      <header className={styles.head}>
        <Kicker>{DESK_TEXTS.today}</Kicker>
        <Lettering className={styles.headTitle}>{todayLabel(view.now)}</Lettering>
      </header>
      {daily !== null && <DailyLeaf daily={daily} index={0} />}
      {riddle !== null && <RiddleLeaf riddle={riddle} index={1} />}
      {word !== null && (
        <div className={styles.rising} style={rise(2)}>
          {word}
        </div>
      )}
      <StockLeaf index={3} />
    </aside>
  );
}

/** On the line of the gold button: the sachets in stock, when the next comes, the reserve. */
function StockLeaf({ index }: { readonly index: number }) {
  const view = usePlayerView();
  if (view.wallet === null) return null;
  const stock = stockView(view.wallet, view.now);
  const reserve = reserveView(view.wallet);
  return (
    <div
      className={`${ui.leaf} ${styles.leaf} ${styles.stock} ${styles.rising}`}
      style={rise(index)}
    >
      <span className={styles.leafKicker}>{DESK_TEXTS.stock}</span>
      <span className={styles.sachets} aria-hidden="true">
        {Array.from({ length: stock.capacity }, (_, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one place per sachet of the stock
          <span key={at} className={at < stock.stored ? styles.sachetHeld : styles.sachetWaiting}>
            <ToyIcon name="sachet" size={24} locked={at >= stock.stored} />
          </span>
        ))}
      </span>
      <span className={styles.leafText}>
        {stock.refillLine}
        {stock.bonus > 0 && ` ${reserve.headline} en réserve.`}
      </span>
    </div>
  );
}

/**
 * The daily challenge: a link to Défis from Jouer; on Défis, `onStart` launches its series, and
 * the leaf is a button until the goal is met.
 */
export function DailyLeaf({
  daily,
  index,
  onStart,
}: {
  readonly daily: DailyChallengeResponse;
  readonly index: number;
  readonly onStart?: (() => void) | undefined;
}) {
  const view = dailyView(daily);
  const content = <DailyContent view={view} />;
  const label = `${DESK_TEXTS.daily}. ${view.title}. ${view.text}`;
  const className = `${ui.leaf} ${styles.leaf} ${styles.rising}`;
  if (onStart !== undefined) {
    return view.done ? (
      <section className={className} style={rise(index)} aria-label={label}>
        {content}
      </section>
    ) : (
      <button
        type="button"
        className={className}
        style={rise(index)}
        aria-label={label}
        onClick={onStart}
      >
        {content}
      </button>
    );
  }
  return (
    <Link href="/defis" className={className} style={rise(index)} aria-label={label}>
      {content}
    </Link>
  );
}

function DailyContent({ view }: { readonly view: ReturnType<typeof dailyView> }) {
  return (
    <>
      <span className={styles.leafHead}>
        <ToyBody matter="red" shape="tile" className={styles.badge}>
          <ToyIcon name="challenge" size={26} />
        </ToyBody>
        <span className={styles.leafTitles}>
          <span className={styles.leafKicker}>{DESK_TEXTS.daily}</span>
          <span className={styles.leafTitle}>{view.title}</span>
        </span>
        {view.done && (
          <span className={styles.done} aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        )}
      </span>
      <span className={styles.pips} aria-hidden="true">
        {view.bars.map((bar, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one pip per question, in order
          <span key={at} className={styles.pip} data-bar={bar} />
        ))}
      </span>
      <span className={`${styles.leafText} ${styles.spare}`}>{view.text}</span>
      {!view.done && <span className={styles.go}>{view.action}</span>}
    </>
  );
}

export function RiddleLeaf({
  riddle,
  index,
}: {
  readonly riddle: RiddleResponse;
  readonly index: number;
}) {
  const started = riddle.step > 0 || riddle.outcome !== null;
  const slots = riddleSlots(riddle);
  return (
    <Link
      href="/enigme"
      className={`${ui.leaf} ${styles.leaf} ${styles.rising}`}
      style={rise(index)}
      aria-label={`${DESK_TEXTS.riddle}, n° ${riddle.number}. ${riddleNature(riddle.partOfSpeech, riddle.letters)}.`}
    >
      <span className={styles.leafHead}>
        <ToyBody matter="gold" shape="tile" className={styles.badge}>
          <span className={styles.badgeGlyph}>
            <Icon name="plume" size={22} />
          </span>
        </ToyBody>
        <span className={styles.leafTitles}>
          <span className={styles.leafKicker}>
            {DESK_TEXTS.riddle} · n° {riddle.number}
          </span>
          <span className={styles.leafTitle}>
            {riddleNature(riddle.partOfSpeech, riddle.letters)}
          </span>
        </span>
        {riddle.outcome === "found" && (
          <span className={styles.done} aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        )}
      </span>
      {/* The word in printing type: the letters uncovered on their blocks, the others hollow. */}
      <span
        className={styles.type}
        style={{ "--letters": slots.length } as CSSProperties}
        aria-hidden="true"
      >
        {slots.map((letter, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one block per letter, in order
          <span key={at} className={letter === null ? styles.blockHollow : styles.block}>
            {letter}
          </span>
        ))}
      </span>
      {started && <span className={styles.leafText}>{riddleProgressLine(riddle)}</span>}
      {riddle.outcome === null && <span className={styles.go}>{riddleAction(riddle)}</span>}
    </Link>
  );
}

/**
 * Right of the desk on a wide screen: the level and the next reward, the coffrets waiting, the
 * clan's week and the doors to the rest of the room.
 */
export function StandingColumn() {
  const view = usePlayerView();
  if (view.now === 0 || view.progress === null) return null;
  return (
    <aside className={styles.column} aria-label={DESK_TEXTS.standing}>
      <header className={styles.head}>
        <Kicker>{DESK_TEXTS.standing}</Kicker>
        <Lettering className={styles.headTitle}>
          Niveau {view.progress.level}
          {view.title !== null && <span className={styles.headSub}> · {view.title}</span>}
        </Lettering>
      </header>
      <LevelLeaf index={0} />
      <ClanLeaf index={1} />
      <Doors index={2} />
    </aside>
  );
}

function LevelLeaf({ index }: { readonly index: number }) {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const { progress } = view;
  if (progress === null) return null;
  const [reward] = upcomingRewards(progress.level, view.now, 1);
  const line = nextRewardLine(progress.level, view.now);
  return (
    <div className={`${ui.leaf} ${styles.leaf} ${styles.rising}`} style={rise(index)}>
      <Link href="/niveaux" className={styles.level} aria-label={levelDescription(progress)}>
        <LevelMedal level={progress.level} size={54} />
        <span className={styles.levelBody}>
          <XpBar ratio={levelRatio(progress)} />
          <span className={styles.levelXp}>{xpProgressLabel(progress)}</span>
        </span>
      </Link>
      {reward !== undefined && (
        <Link href={`/niveaux#niveau-${reward.level}`} className={styles.next}>
          <span className={reward.milestone ? play.nextIconKraft : play.nextIcon}>
            <Icon name={REWARD_ICONS[reward.icon]} size={22} />
          </span>
          <span className={styles.leafText}>{line}</span>
        </Link>
      )}
      {view.coffrets.length > 0 && (
        <Button glow className={styles.claim} onClick={() => openCoffret()}>
          <Icon name="coffret" size={20} />
          Ouvrir {coffretsLabel(view.coffrets.length)}
        </Button>
      )}
    </div>
  );
}

function ClanLeaf({ index }: { readonly index: number }) {
  const view = usePlayerView();
  const clan = useShared(myClan);
  const { openChat } = useShell();
  const router = useRouter();
  const level = view.progress?.level ?? 1;
  const locked = playFabs({ level, coffrets: 0, mail: 0 }, view.now).left.find(
    (fab) => fab.id === "clan",
  )?.lock;
  if (clan === null) return null;

  if (clan.clanId === null || clan.emblem === null) {
    return (
      <div
        className={`${ui.leaf} ${styles.leaf} ${styles.rising} ${locked != null ? styles.closed : ""}`}
        style={rise(index)}
      >
        <span className={styles.leafHead}>
          <ToyBody
            matter={locked != null ? "locked" : "blue"}
            shape="tile"
            className={styles.badge}
          >
            <ToyIcon name="clan" size={26} locked={locked != null} />
          </ToyBody>
          <span className={styles.leafTitles}>
            <span className={styles.leafKicker}>Clan</span>
            <span className={styles.leafText}>
              {locked != null ? lockedToast("join_clan", view.now) : DESK_TEXTS.clanInvite}
            </span>
          </span>
        </span>
        {locked == null && (
          <Button variant="secondary" small onClick={() => router.push("/clan")}>
            {DESK_TEXTS.findClan}
          </Button>
        )}
      </div>
    );
  }

  const ring = clan.goal === null ? null : goalRing(clan.goal);
  return (
    <div className={`${ui.leaf} ${styles.leaf} ${styles.rising}`} style={rise(index)}>
      <Link href="/clan" className={styles.leafHead}>
        <Emblem emblem={clan.emblem} size={46} />
        <span className={styles.leafTitles}>
          <span className={styles.leafKicker}>{DESK_TEXTS.clanGoal}</span>
          <span className={styles.leafTitle}>{ring === null ? DESK_TEXTS.seeClan : ring.text}</span>
        </span>
      </Link>
      {ring !== null && (
        <span className={styles.goal} aria-hidden="true">
          <span className={styles.goalFill} style={{ width: `${Math.round(ring.ratio * 100)}%` }} />
        </span>
      )}
      <span className={styles.actions}>
        <Button variant="secondary" small onClick={openChat}>
          <Icon name="chat" size={16} />
          {DESK_TEXTS.chat}
        </Button>
        <Button variant="secondary" small onClick={() => router.push("/clan")}>
          {DESK_TEXTS.seeClan}
        </Button>
      </span>
    </div>
  );
}

/** The rest of the room, as the tiles of the phone: friends, jousts, settings. */
function Doors({ index }: { readonly index: number }) {
  const view = usePlayerView();
  const shell = useShell();
  const router = useRouter();
  const level = view.progress?.level ?? 1;
  const jousts = playFabs({ level, coffrets: 0, mail: 0 }, view.now).left.find(
    (fab) => fab.id === "jousts",
  );
  return (
    <div className={`${styles.doors} ${styles.rising}`} style={rise(index)}>
      <SideTile icon="friends" matter="green" label="Amis" onClick={() => router.push("/amis")} />
      <SideTile
        icon="jousts"
        matter="red"
        label="Joutes"
        lockedAt={jousts?.lock ?? undefined}
        onClick={() => router.push("/joutes")}
      />
      <SideTile icon="settings" matter="gold" label="Réglages" onClick={shell.openSettings} />
    </div>
  );
}

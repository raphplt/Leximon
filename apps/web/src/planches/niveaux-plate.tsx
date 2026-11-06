"use client";

import type { Progress } from "@leximon/contract";
import { xpToReach } from "@leximon/core";
import { type ToyIconName, toyIconInks } from "@leximon/tokens";
import {
  featureMilestones,
  levelDetail,
  opensAt,
  playerTitle,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  type RewardIcon,
  type RoadNode,
  rewardItem,
  rewardsOfLevel,
  waitingCoffrets,
  xpProgressLabel,
  xpSources,
  xpToNextLabel,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { Icon, type IconName } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { ParticleStage } from "@/ui/stage";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./niveaux-plate.module.css";

/**
 * A plate of three ways to draw the level page, on made-up players: the owner picks one before
 * the screen is rebuilt. The rewards, chapters and unlocks are the real ones of the rules in force.
 */

type Moment = "start" | "waiting" | "done";

const MOMENTS: readonly { readonly id: Moment; readonly label: string }[] = [
  { id: "start", label: "Niveau 4, débutant" },
  { id: "waiting", label: "Niveau 17, 5 coffrets" },
  { id: "done", label: "Niveau 17, tout ouvert" },
];

type Direction = "road" | "track" | "chests";

const DIRECTIONS: readonly { readonly id: Direction; readonly label: string }[] = [
  { id: "road", label: "A. La route" },
  { id: "track", label: "B. La piste" },
  { id: "chests", label: "C. Les coffrets" },
];

interface Player {
  readonly progress: Progress;
  readonly claimed: readonly number[];
}

function player(level: number, ratio: number, claimedUpTo: number): Player {
  const into = xpToReach(level + 1) - xpToReach(level);
  const xpIntoLevel = Math.round(into * ratio);
  return {
    progress: { level, xp: xpToReach(level) + xpIntoLevel, xpIntoLevel, xpForNextLevel: into },
    claimed: Array.from({ length: Math.max(0, claimedUpTo - 1) }, (_, k) => k + 2),
  };
}

const PLAYERS: Readonly<Record<Moment, Player>> = {
  start: player(4, 0.4, 4),
  waiting: player(17, 0.88, 12),
  done: player(17, 0.88, 17),
};

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

export function NiveauxPlate() {
  const [moment, setMoment] = useState<Moment>("waiting");
  const [direction, setDirection] = useState<Direction>("road");
  const now = Date.now();
  const { progress, claimed } = PLAYERS[moment];
  return (
    <main className={styles.page}>
      <ParticleStage dust>
        <nav className={styles.controls} aria-label="État de la planche">
          <span className={styles.controlsLabel}>Planche Niveaux</span>
          {DIRECTIONS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === direction ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === direction}
              onClick={() => setDirection(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>
        <nav className={styles.controls} aria-label="Joueur de la planche">
          {MOMENTS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === moment ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === moment}
              onClick={() => setMoment(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>
        <div className={styles.screen} key={`${direction}-${moment}`}>
          <header className={styles.header}>
            <span className={ui.round}>
              <Icon name="back" size={20} />
            </span>
            <Lettering className={styles.title}>Niveaux</Lettering>
          </header>
          <Hero progress={progress} claimed={claimed} now={now} />
          {direction === "road" && <Road progress={progress} claimed={claimed} now={now} />}
          {direction === "track" && <Track progress={progress} claimed={claimed} now={now} />}
          {direction === "chests" && <Chests progress={progress} claimed={claimed} now={now} />}
        </div>
      </ParticleStage>
    </main>
  );
}

interface Props {
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
}

// --- Shared: the head of the page, the rewards drawn as toys, the detail, where XP comes from ---

/** The player's level in big, the bar to the next one, and the coffrets that wait. */
function Hero({ progress, claimed, now }: Props) {
  const waiting = waitingCoffrets(progress.level, claimed);
  const title = playerTitle(claimed, now);
  const next = rewardsOfLevel(progress.level + 1, now)[0];
  const ratio = progress.xpIntoLevel / progress.xpForNextLevel;
  return (
    <section className={`${ui.leaf} ${styles.hero} ${desk.rising}`} style={rise(0)}>
      <div className={styles.heroMedal}>
        <span className={styles.ring} style={{ "--ratio": ratio } as CSSProperties}>
          <LevelMedal level={progress.level} size={84} />
        </span>
      </div>
      <div className={styles.heroText}>
        <span className={desk.leafKicker}>{title ?? "Pas encore de titre"}</span>
        <h2 className={styles.heroTitle}>Niveau {progress.level}</h2>
        <div className={styles.heroBar} aria-hidden="true">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          <b>{xpProgressLabel(progress)}</b>
        </div>
        <p className={styles.heroNext}>{xpToNextLabel(progress)}</p>
      </div>
      <div className={styles.heroAction}>
        {waiting.length > 0 ? (
          <>
            <span className={styles.heroChest}>
              <ToyIcon name="chest" size={64} />
            </span>
            <MainAction label="Ouvrir un coffret" count={String(waiting.length)} />
          </>
        ) : (
          next !== undefined && (
            <div className={styles.heroComing}>
              <RewardToy icon={rewardItem(next).icon} size={52} />
              <span>
                <span className={desk.leafKicker}>Au niveau {progress.level + 1}</span>
                <strong>{rewardItem(next).title}</strong>
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}

const REWARD_TOYS: Readonly<
  Record<
    RewardIcon | "lock",
    { toy: ToyIconName; gilt?: true } | { line: IconName; matter: Matter }
  >
> = {
  sachet: { toy: "sachet" },
  star: { toy: "sachet", gilt: true },
  bolt: { line: "bolt", matter: "gold" },
  plume: { line: "plume", matter: "red" },
  carte: { line: "carte", matter: "blue" },
  plus: { line: "plus", matter: "blue" },
  profil: { line: "profil", matter: "green" },
  cadre: { line: "palette", matter: "gold" },
  pin: { line: "pin", matter: "red" },
  ecu: { toy: "ecu" },
  lock: { toy: "lock" },
};

type Matter = "gold" | "red" | "green" | "blue";

/** A reward as a small toy: the sachets and écus drawn, the rest a coin with its sign. */
function RewardToy({
  icon,
  size,
  dim = false,
}: {
  readonly icon: RewardIcon | "lock";
  readonly size: number;
  readonly dim?: boolean;
}) {
  const look = REWARD_TOYS[icon];
  if ("toy" in look) {
    return (
      <ToyIcon
        name={look.toy}
        size={size}
        locked={dim}
        inks={look.gilt ? toyIconInks.gilded : toyIconInks[look.toy]}
      />
    );
  }
  return (
    <span className={styles.coinWrap} style={{ width: size, height: size }}>
      <ToyBody matter={dim ? "locked" : look.matter} shape="round" className={styles.coin}>
        <Icon name={look.line} size={Math.round(size * 0.48)} />
      </ToyBody>
    </span>
  );
}

/** The main reward of a level, the one its node shows. */
function mainIcon(level: number, now: number): RewardIcon | "lock" {
  if (opensAt(level, now) !== null) return "lock";
  const rewards = rewardsOfLevel(level, now);
  const special = rewards.find((reward) => reward.kind !== "bonus_booster") ?? rewards[0];
  return special === undefined ? "star" : rewardItem(special).icon;
}

/** What a level gives, as a stack of toys with their words, and its button. */
function Detail({ level, progress, claimed, now }: Props & { readonly level: number }) {
  const detail = levelDetail(level, progress, claimed, now);
  return (
    <section className={`${ui.leaf} ${styles.detail}`} aria-live="polite">
      <span className={desk.leafKicker}>Niveau {detail.level}</span>
      <h3 className={styles.detailTitle}>{detail.title}</h3>
      <ul className={styles.items}>
        {detail.items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list; two rewards may be alike
          <li key={index} className={styles.item}>
            <RewardToy icon={item.icon} size={40} dim={detail.state === "locked"} />
            <span>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {detail.opens !== null && (
        <p className={styles.opens}>
          <ToyIcon name="lock" size={30} />
          <span>
            Débloque <strong>{detail.opens.toLowerCase()}</strong>
          </span>
        </p>
      )}
      {detail.state === "claimable" && <MainAction label="Ouvrir le coffret" />}
      {detail.state === "claimed" && (
        <p className={styles.done}>
          <Icon name="check" size={18} /> Coffret ouvert
        </p>
      )}
      {detail.xpLeft !== null && <p className={styles.left}>{detail.xpLeft}</p>}
    </section>
  );
}

const XP_TOYS: readonly ToyIconName[] = [
  "sachet",
  "challenge",
  "album",
  "challenges",
  "gilded",
  "trades",
  "chest",
];

/** Where XP comes from, each source a drawn tile with its figure. */
function XpSources({ now, index }: { readonly now: number; readonly index: number }) {
  return (
    <section className={`${ui.leaf} ${styles.xp} ${desk.rising}`} style={rise(index)}>
      <span className={desk.leafKicker}>D'où vient l'XP</span>
      <ul className={styles.xpList}>
        {xpSources(now).map((source, k) => (
          <li key={source.action} className={styles.xpTile}>
            <ToyIcon name={XP_TOYS[k] ?? "blank"} size={34} />
            <span className={styles.xpAction}>{source.action}</span>
            <strong className={styles.xpFigure}>{source.xp} XP</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The parts of the game still closed, each with the level that opens it. */
function Unlocks({ progress, now, index }: Props & { readonly index: number }) {
  const ahead = featureMilestones(now).filter((level) => level > progress.level);
  if (ahead.length === 0) return null;
  return (
    <section className={`${ui.leaf} ${styles.unlocks} ${desk.rising}`} style={rise(index)}>
      <span className={desk.leafKicker}>À débloquer</span>
      <ul className={styles.unlockList}>
        {ahead.map((level) => (
          <li key={level} className={styles.unlock}>
            <span className={styles.unlockToy}>
              <ToyIcon name="lock" size={38} />
              <ToyBody matter="dark" shape="tag" className={styles.unlockLevel}>
                <Lettering>{level}</Lettering>
              </ToyBody>
            </span>
            <span>{opensAt(level, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The player's own level is drawn apart, unless its coffret still waits: the chest comes first. */
function stateOf(node: RoadNode, level: number): string {
  return node.level === level && node.state !== "claimable" ? "here" : node.state;
}

/** The chapter shown first: the one of the oldest coffret, else the player's. */
function firstQuarter(progress: Progress, claimed: readonly number[]): Quarter {
  const [oldest] = waitingCoffrets(progress.level, claimed);
  return quarterOfLevel(oldest ?? progress.level);
}

function firstLevel(progress: Progress, claimed: readonly number[]): number {
  return waitingCoffrets(progress.level, claimed)[0] ?? progress.level + 1;
}

/** Chapter tabs: the player's and the two after it. */
function ChapterTabs({
  progress,
  shown,
  onShow,
}: {
  readonly progress: Progress;
  readonly shown: Quarter;
  readonly onShow: (quarter: Quarter) => void;
}) {
  const own = quarterOfLevel(progress.level);
  const quarters = Array.from({ length: own.index + 2 }, (_, k) => quarterAt(k + 1));
  return (
    <div className={styles.tabs}>
      {quarters.map((quarter) => (
        <Toy
          key={quarter.index}
          matter={
            quarter.index === shown.index ? "gold" : quarter.index > own.index ? "locked" : "paper"
          }
          className={styles.tab}
          aria-pressed={quarter.index === shown.index}
          onClick={() => onShow(quarter)}
        >
          {quarter.index < own.index && <Icon name="check" size={14} />}
          {quarter.index > own.index && <Icon name="lock" size={14} />}
          {quarter.name}
        </Toy>
      ))}
    </div>
  );
}

// --- A. The road: the chapter as a winding path of round stops ------------------------------

/** Where each stop of the road stands across the page, in percent: a gentle snake. */
const SWAY = [50, 72, 80, 64, 40, 24, 30, 52, 74, 62];
const ROW = 104;

function Road({ progress, claimed, now }: Props) {
  const [quarter, setQuarter] = useState(() => firstQuarter(progress, claimed));
  const [selected, setSelected] = useState(() => firstLevel(progress, claimed));
  const nodes = quarterNodes(quarter, progress.level, claimed, now);
  const height = nodes.length * ROW;
  const points = nodes.map((_, k) => ({ x: SWAY[k % SWAY.length] ?? 50, y: k * ROW + ROW / 2 }));
  const path = points
    .map((point, k) => {
      const previous = points[k - 1];
      if (previous === undefined) return `M${point.x} ${point.y}`;
      const middle = (previous.y + point.y) / 2;
      return `C${previous.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`;
    })
    .join(" ");
  const reached = nodes.filter((node) => node.level <= progress.level).length;
  const donePath = points
    .slice(0, reached)
    .map((point, k, all) => {
      const previous = all[k - 1];
      if (previous === undefined) return `M${point.x} ${point.y}`;
      const middle = (previous.y + point.y) / 2;
      return `C${previous.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <div className={styles.roadLayout}>
      <section className={`${ui.leaf} ${styles.roadLeaf} ${desk.rising}`} style={rise(1)}>
        <ChapterTabs
          progress={progress}
          shown={quarter}
          onShow={(next) => {
            setQuarter(next);
            setSelected(next.first);
          }}
        />
        <div className={styles.banner}>
          <span className={styles.bannerRibbon}>
            <Lettering>{quarter.name}</Lettering>
          </span>
          <span className={styles.bannerRange}>
            {quarter.chapter} · {quarter.range}
          </span>
        </div>
        <ol className={styles.road} style={{ height }}>
          <svg
            className={styles.roadPath}
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={path} className={styles.pathAhead} />
            {reached > 1 && <path d={donePath} className={styles.pathDone} />}
          </svg>
          {nodes.map((node, k) => {
            const x = SWAY[k % SWAY.length] ?? 50;
            const state = stateOf(node, progress.level);
            return (
              <li
                key={node.level}
                className={styles.stop}
                data-state={state}
                data-milestone={node.milestone || undefined}
                data-side={x > 50 ? "left" : "right"}
                style={{ "--x": `${x}%`, top: k * ROW } as CSSProperties}
              >
                <button
                  type="button"
                  className={styles.stopButton}
                  aria-label={node.label}
                  aria-pressed={node.level === selected}
                  onClick={() => setSelected(node.level)}
                >
                  <StopToken node={node} progress={progress} />
                </button>
                <span className={styles.stopTag} data-chosen={node.level === selected || undefined}>
                  <RewardToy icon={mainIcon(node.level, now)} size={26} dim={node.fog} />
                  <span>{node.opens !== null ? node.opens : shortSummary(node.summary)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <div className={styles.side}>
        <Detail level={selected} progress={progress} claimed={claimed} now={now} />
        <Unlocks progress={progress} claimed={claimed} now={now} index={2} />
        <XpSources now={now} index={3} />
      </div>
    </div>
  );
}

/** « Sachet garni · Titre » keeps its two first rewards and counts the rest. */
function shortSummary(summary: string): string {
  const parts = summary.split(" · ");
  return parts.length <= 2 ? summary : `${parts.slice(0, 2).join(" · ")} +${parts.length - 2}`;
}

function StopToken({ node, progress }: { readonly node: RoadNode; readonly progress: Progress }) {
  if (node.level === progress.level) {
    return (
      <span className={styles.here}>
        <LevelMedal level={node.level} size={node.milestone ? 78 : 70} />
        {node.state === "claimable" && (
          <span className={styles.hereChest}>
            <ToyIcon name="chest" size={34} />
          </span>
        )}
      </span>
    );
  }
  if (node.state === "claimable") {
    return (
      <span className={styles.chestStop}>
        <ToyIcon name="chest" size={node.milestone ? 66 : 56} />
        <ToyBody matter="red" shape="tag" className={styles.stopNumber}>
          <Lettering>{node.level}</Lettering>
        </ToyBody>
      </span>
    );
  }
  return (
    <ToyBody
      matter={node.state === "claimed" ? "gold" : node.state === "next" ? "paper" : "locked"}
      shape="round"
      className={styles.disc}
    >
      <Lettering>{node.level}</Lettering>
      {node.state === "claimed" && (
        <span className={styles.tick}>
          <Icon name="check" size={12} />
        </span>
      )}
      {node.state === "next" && (
        <span
          className={styles.discRing}
          style={{ "--ratio": progress.xpIntoLevel / progress.xpForNextLevel } as CSSProperties}
        />
      )}
    </ToyBody>
  );
}

// --- B. The track: every level side by side on a gauge, swiped sideways -----------------------

function Track({ progress, claimed, now }: Props) {
  const own = quarterOfLevel(progress.level);
  const last = quarterAt(own.index + 2).last;
  const [selected, setSelected] = useState(() => firstLevel(progress, claimed));
  const strip = useRef<HTMLOListElement>(null);
  const nodes = Array.from({ length: own.index + 2 }, (_, k) =>
    quarterNodes(quarterAt(k + 1), progress.level, claimed, now),
  ).flat();
  const ratio = progress.xpIntoLevel / progress.xpForNextLevel;

  useEffect(() => {
    const element = strip.current?.querySelector<HTMLElement>(
      `[data-level="${firstLevel(progress, claimed)}"]`,
    );
    const list = strip.current;
    if (element === null || element === undefined || list === null) return;
    list.scrollLeft = element.offsetLeft - list.clientWidth / 2 + element.clientWidth / 2;
  }, [progress, claimed]);

  return (
    <>
      <section className={`${ui.leaf} ${styles.trackLeaf} ${desk.rising}`} style={rise(1)}>
        <ol className={styles.track} ref={strip}>
          {nodes.map((node) => {
            const state = stateOf(node, progress.level);
            const quarter = quarterOfLevel(node.level);
            const fill =
              node.level <= progress.level ? 1 : node.level === progress.level + 1 ? ratio : 0;
            return (
              <li
                key={node.level}
                data-level={node.level}
                className={styles.column}
                data-state={state}
                data-milestone={node.milestone || undefined}
              >
                <span className={styles.chapterFlag}>
                  {node.level === quarter.first && (
                    <>
                      <ToyIcon name="community" size={20} />
                      {quarter.name}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.card}
                  aria-label={node.label}
                  aria-pressed={node.level === selected}
                  onClick={() => setSelected(node.level)}
                >
                  {node.milestone && <span className={styles.cardRibbon}>Palier</span>}
                  <span className={styles.cardToy}>
                    {node.state === "claimable" ? (
                      <ToyIcon name="chest" size={52} />
                    ) : (
                      <RewardToy icon={mainIcon(node.level, now)} size={44} dim={node.fog} />
                    )}
                  </span>
                  <span className={styles.cardWord}>
                    {node.opens !== null ? node.opens : shortSummary(node.summary)}
                  </span>
                  {node.state === "claimable" && <span className={styles.cardOpen}>Ouvrir</span>}
                  {node.state === "claimed" && node.level > 1 && (
                    <span className={styles.cardDone}>
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </button>
                <span className={styles.gauge} aria-hidden="true">
                  <span style={{ width: `${fill * 100}%` }} />
                </span>
                <span className={styles.gaugeStop}>
                  {node.level === progress.level ? (
                    <LevelMedal level={node.level} size={46} />
                  ) : (
                    <ToyBody
                      matter={node.level < progress.level ? "gold" : "locked"}
                      shape="round"
                      className={styles.gaugeNumber}
                    >
                      <Lettering>{node.level}</Lettering>
                    </ToyBody>
                  )}
                </span>
              </li>
            );
          })}
          <li className={styles.trackEnd}>
            <ToyIcon name="lock" size={34} />
            <span>Les chapitres suivants s'ouvrent au niveau {last - 9}.</span>
          </li>
        </ol>
      </section>
      <div className={styles.trackBelow}>
        <Detail level={selected} progress={progress} claimed={claimed} now={now} />
        <Unlocks progress={progress} claimed={claimed} now={now} index={2} />
        <XpSources now={now} index={3} />
      </div>
    </>
  );
}

// --- C. The chests: a chapter as ten chests, the fifth and tenth in gold ------------------------

function Chests({ progress, claimed, now }: Props) {
  const [quarter, setQuarter] = useState(() => firstQuarter(progress, claimed));
  const [selected, setSelected] = useState(() => firstLevel(progress, claimed));
  const nodes = quarterNodes(quarter, progress.level, claimed, now);
  const opened = nodes.filter((node) => node.state === "claimed").length;
  return (
    <div className={styles.chestLayout}>
      <section className={`${ui.leaf} ${styles.chestLeaf} ${desk.rising}`} style={rise(1)}>
        <ChapterTabs
          progress={progress}
          shown={quarter}
          onShow={(next) => {
            setQuarter(next);
            setSelected(next.first);
          }}
        />
        <header className={styles.chestHead}>
          <div>
            <span className={desk.leafKicker}>
              {quarter.chapter} · {quarter.range}
            </span>
            <h3 className={styles.detailTitle}>{quarter.name}</h3>
          </div>
          <span className={styles.chestCount}>
            <ToyIcon name="chest" size={30} />
            {opened} / {nodes.length} ouverts
          </span>
        </header>
        <ol className={styles.grid}>
          {nodes.map((node) => {
            const state = stateOf(node, progress.level);
            return (
              <li key={node.level}>
                <button
                  type="button"
                  className={styles.tile}
                  data-state={state}
                  data-milestone={node.milestone || undefined}
                  aria-label={node.label}
                  aria-pressed={node.level === selected}
                  onClick={() => setSelected(node.level)}
                >
                  {node.level === progress.level ? (
                    <span className={styles.tileHere}>
                      <LevelMedal level={node.level} size={34} />
                    </span>
                  ) : (
                    <span className={styles.tileLevel}>{node.level}</span>
                  )}
                  <span className={styles.tileToy}>
                    {node.state === "claimable" || node.state === "claimed" ? (
                      <ToyIcon name="chest" size={node.milestone ? 56 : 48} />
                    ) : node.level === progress.level ? (
                      <LevelMedal level={node.level} size={52} />
                    ) : (
                      <RewardToy icon={mainIcon(node.level, now)} size={44} dim={node.fog} />
                    )}
                  </span>
                  <span className={styles.tileWord}>
                    {node.opens !== null ? node.opens : shortSummary(node.summary)}
                  </span>
                  {node.state === "claimed" && node.level > 1 && (
                    <span className={styles.tileDone}>
                      <Icon name="check" size={14} />
                    </span>
                  )}
                  {node.state === "next" && (
                    <span className={styles.tileBar}>
                      <span
                        style={{
                          width: `${(progress.xpIntoLevel / progress.xpForNextLevel) * 100}%`,
                        }}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <div className={styles.side}>
        <Detail level={selected} progress={progress} claimed={claimed} now={now} />
        <Unlocks progress={progress} claimed={claimed} now={now} index={2} />
        <XpSources now={now} index={3} />
      </div>
    </div>
  );
}

"use client";

import type { Progress } from "@leximon/contract";
import { toyIconInks } from "@leximon/tokens";
import {
  levelDetail,
  nextChapterSign,
  playerTitle,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  ROAD_ROW,
  type RoadNode,
  roadGeometry,
  unlocksAhead,
  upcomingRewards,
  XP_SOURCES_TITLE,
  xpProgressLabel,
  xpSources,
  xpToNextLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { levelRewards } from "@/player/player";
import { useSharedFailed } from "@/player/resource";
import { retryProgress, useProgressFailed } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { LoadFailed } from "@/ui/load-failed";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./level-road.module.css";
import { RewardToy } from "./reward-toy";

/** Chapters the player may look at beyond their own. */
const QUARTERS_AHEAD = 2;

/** A level asked for in the address (`#niveau-12`, from the next rewards of Jouer). */
function levelFromHash(): number | null {
  const match = /^#niveau-(\d+)$/.exec(window.location.hash);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** The level shown first beside the road: a coffret that waits there, else the next level. */
function firstOf(nodes: readonly RoadNode[], level: number): number {
  return (
    nodes.find((node) => node.state === "claimable")?.level ??
    nodes.find((node) => node.level === level + 1)?.level ??
    nodes[0]?.level ??
    level
  );
}

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

interface Me {
  readonly avatar: string | null;
  readonly frame: string | null;
}

/**
 * The levels as a road that winds down a chapter of ten. The page holds in the window: the road
 * scrolls in its own box, which opens on the player's level.
 */
export function LevelRoadScreen() {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const [selected, setSelected] = useState<number | null>(null);
  // Below the width of the side column, the detail of a level opens in a bubble under its stop.
  const [bubble, setBubble] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [asked, setAsked] = useState<number | null>(null);
  const { progress, now, claimed } = view;
  const progressFailed = useProgressFailed();
  const rewardsFailed = useSharedFailed(levelRewards);

  useEffect(() => {
    const level = levelFromHash();
    if (level === null) return;
    setAsked(level);
    setSelected(level);
    setBubble(level);
    setShown(quarterOfLevel(level).index);
  }, []);

  if ((progress === null && progressFailed) || (claimed === null && rewardsFailed)) {
    return (
      <main className={styles.page}>
        <Header />
        <LoadFailed
          onRetry={() => {
            retryProgress();
            levelRewards.ensure();
          }}
        />
      </main>
    );
  }
  if (progress === null || claimed === null || now === 0) {
    return (
      <main className={styles.page}>
        <Header />
        <div className={`${ui.leaf} ${styles.loading}`} />
      </main>
    );
  }

  const own = quarterOfLevel(progress.level);
  const last = own.index + QUARTERS_AHEAD;
  const quarter = quarterAt(Math.min(last, shown ?? own.index));
  const nodes = quarterNodes(quarter, progress.level, claimed, now);
  // The road opens on the level asked for, else on the player's, else on its first coffret.
  const focus =
    [asked, progress.level, nodes.find((node) => node.state === "claimable")?.level].find(
      (level) => level != null && level >= quarter.first && level <= quarter.last,
    ) ?? null;
  const chosen =
    selected !== null && selected >= quarter.first && selected <= quarter.last
      ? selected
      : (focus ?? firstOf(nodes, progress.level));

  const pick = (node: RoadNode) => {
    setSelected(node.level);
    if (node.state === "claimable") {
      setBubble(null);
      openCoffret(node.level);
    } else {
      setBubble((open) => (open === node.level ? null : node.level));
    }
  };
  const show = (index: number) => {
    setShown(index);
    setSelected(null);
    setBubble(null);
    setAsked(null);
  };
  const sign = nextChapterSign(quarter.index, own.index, QUARTERS_AHEAD);

  return (
    <main className={styles.page}>
      <Header />
      <Hero progress={progress} claimed={claimed} now={now} coffrets={view.coffrets.length} />
      <div className={styles.layout}>
        <section
          className={`${ui.leaf} ${styles.roadLeaf} ${desk.rising}`}
          style={rise(1)}
          aria-label={`${quarter.name}, ${quarter.range}`}
        >
          <ChapterTabs own={own} last={last} shown={quarter} onShow={show} />
          <Road
            key={quarter.index}
            quarter={quarter}
            nodes={nodes}
            progress={progress}
            claimed={claimed}
            now={now}
            me={{ avatar: view.profile?.avatar ?? null, frame: view.profile?.frame ?? null }}
            chosen={chosen}
            focus={focus}
            bubble={bubble}
            onPick={pick}
            onCoffret={openCoffret}
            end={
              <ChapterSignpost
                name={sign.name}
                note={sign.note}
                open={sign.open && quarter.index < last}
                onShow={() => show(sign.index)}
              />
            }
            after={
              <div className={styles.unlocksInRoad}>
                <Unlocks level={progress.level} now={now} />
              </div>
            }
          />
        </section>
        <div className={styles.side}>
          <Detail
            level={chosen}
            progress={progress}
            claimed={claimed}
            now={now}
            onCoffret={openCoffret}
          />
          <Unlocks level={progress.level} now={now} />
        </div>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className={styles.header}>
      <Link href="/jouer" className={ui.round} aria-label="Retour">
        <Icon name="back" size={20} />
      </Link>
      <h1 className={styles.title}>
        <Lettering>Niveaux</Lettering>
      </h1>
    </header>
  );
}

/** The player's level in big, the bar to the next one, and the coffrets that wait. */
function Hero({
  progress,
  claimed,
  now,
  coffrets,
}: {
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
  readonly coffrets: number;
}) {
  const { openCoffret } = useShell();
  const title = playerTitle(claimed, now);
  const [next] = upcomingRewards(progress.level, now, 1);
  const ratio = Math.min(1, progress.xpIntoLevel / progress.xpForNextLevel);
  return (
    <section className={`${ui.leaf} ${styles.hero} ${desk.rising}`} style={rise(0)}>
      <span className={styles.ring} style={{ "--ratio": ratio } as CSSProperties}>
        <LevelMedal level={progress.level} size={84} />
      </span>
      <div className={styles.heroText}>
        {title !== null && <span className={desk.leafKicker}>{title}</span>}
        <h2 className={styles.heroTitle}>Niveau {progress.level}</h2>
        <div className={styles.heroBar} aria-hidden="true">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          <b>{xpProgressLabel(progress)}</b>
        </div>
        <div className={styles.heroNext}>
          <span>{xpToNextLabel(progress)}</span>
          <HelpTip label={XP_SOURCES_TITLE} title={XP_SOURCES_TITLE}>
            <ul className={styles.xpList}>
              {xpSources(now).map((source) => (
                <li key={source.action} className={styles.xpLine}>
                  <ToyIcon name={source.icon} size={28} />
                  <span>{source.action}</span>
                  <strong>{source.xp} XP</strong>
                </li>
              ))}
            </ul>
          </HelpTip>
        </div>
      </div>
      <div className={styles.heroAction}>
        {coffrets > 0 ? (
          <>
            <span className={styles.heroChest} aria-hidden="true">
              <span className={styles.hop}>
                <ToyIcon name="chest" size={60} />
              </span>
            </span>
            <span className={styles.heroMain}>
              <MainAction
                label="Ouvrir un coffret"
                count={String(coffrets)}
                onClick={() => openCoffret()}
              />
            </span>
            {/* On a phone, a smaller button leaves the road its room. */}
            <Toy matter="gold" className={styles.heroCompact} onClick={() => openCoffret()}>
              <ToyIcon name="chest" size={30} />
              <Lettering>Ouvrir un coffret</Lettering>
              <ToyBody matter="red" shape="round" className={styles.heroCount}>
                <Lettering>{coffrets}</Lettering>
              </ToyBody>
            </Toy>
          </>
        ) : (
          next !== undefined && (
            <div className={styles.coming}>
              <RewardToy icon={next.icon} size={44} />
              <span>
                <span className={desk.leafKicker}>Au niveau {next.level}</span>
                <strong>{next.opens ?? next.title}</strong>
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}

/** The player's chapter, those before it and two after it. */
function ChapterTabs({
  own,
  last,
  shown,
  onShow,
}: {
  readonly own: Quarter;
  readonly last: number;
  readonly shown: Quarter;
  readonly onShow: (index: number) => void;
}) {
  const quarters = Array.from({ length: last }, (_, k) => quarterAt(k + 1));
  return (
    <nav className={styles.tabs} aria-label="Chapitres">
      {quarters.map((quarter) => (
        <Toy
          key={quarter.index}
          matter={
            quarter.index === shown.index ? "gold" : quarter.index > own.index ? "locked" : "paper"
          }
          className={styles.tab}
          aria-pressed={quarter.index === shown.index}
          onClick={() => onShow(quarter.index)}
        >
          {quarter.index < own.index && <Icon name="check" size={14} />}
          {quarter.index > own.index && <Icon name="lock" size={14} />}
          {quarter.name}
        </Toy>
      ))}
    </nav>
  );
}

/** Scrolls the road's box so that `y`, measured from its top, sits at `share` of its height. */
function scrollBoxTo(box: HTMLElement, road: HTMLElement, y: number, share: number) {
  const top = road.offsetTop + y - box.clientHeight * share;
  box.scrollTo({ top: Math.max(0, top) });
}

function Road({
  quarter,
  nodes,
  progress,
  claimed,
  now,
  me,
  chosen,
  focus,
  bubble,
  onPick,
  onCoffret,
  end,
  after,
}: {
  readonly quarter: Quarter;
  readonly nodes: readonly RoadNode[];
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
  readonly me: Me;
  readonly chosen: number;
  readonly focus: number | null;
  readonly bubble: number | null;
  readonly onPick: (node: RoadNode) => void;
  readonly onCoffret: (level: number) => void;
  readonly end: ReactNode;
  readonly after: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const roadBox = useRef<HTMLDivElement>(null);
  const reached = nodes.filter((node) => node.level <= progress.level).length;
  // The road is drawn on a width of 100 and stretched; its strokes keep their thickness.
  const road = roadGeometry(nodes.length, reached, progress.level > quarter.last, 100);
  const open = nodes.findIndex((node) => node.level === bubble);
  // Near the end of the road the bubble opens above its stop, to stay on the leaf.
  const above = open >= nodes.length - 3;
  const focusAt = nodes.findIndex((node) => node.level === focus);

  // Opens once on the level in focus; the chapter's own key gives each chapter its first look.
  const [first] = useState(focusAt);
  useEffect(() => {
    if (box.current === null || roadBox.current === null || first === -1) return;
    scrollBoxTo(box.current, roadBox.current, first * ROAD_ROW + ROAD_ROW / 2, 0.45);
  }, [first]);

  useEffect(() => {
    if (box.current === null || roadBox.current === null || open === -1) return;
    const y = above ? (open + 1) * ROAD_ROW : open * ROAD_ROW;
    scrollBoxTo(box.current, roadBox.current, y, above ? 0.92 : 0.06);
  }, [open, above]);

  return (
    <div className={styles.scroll} ref={box}>
      <div className={styles.banner}>
        <span className={styles.ribbon}>
          <Lettering>{quarter.name}</Lettering>
        </span>
        <span className={styles.range}>
          {quarter.chapter} · {quarter.range}
        </span>
      </div>
      <div className={styles.road} style={{ height: road.height }} ref={roadBox}>
        <svg
          className={styles.path}
          viewBox={`0 0 100 ${road.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={road.ahead} className={styles.pathShadow} transform="translate(0 6)" />
          <path d={road.ahead} className={styles.pathEdge} />
          <path d={road.ahead} className={styles.pathBed} />
          <path d={road.ahead} className={styles.pathMarks} />
          {road.done !== "" && (
            <>
              <path d={road.done} className={styles.pathGold} />
              <path d={road.done} className={styles.pathGlint} transform="translate(0 -2)" />
              <path d={road.done} className={styles.pathStuds} />
            </>
          )}
        </svg>
        {road.decor.map((item) => (
          <span
            key={item.y}
            className={styles.decor}
            data-small={item.small || undefined}
            style={{ left: `${item.x}%`, top: item.y }}
            aria-hidden="true"
          >
            <ToyIcon name={item.kind} size={item.small ? 40 : 50} />
          </span>
        ))}
        <ol className={styles.stops}>
          {nodes.map((node, k) => {
            const stop = road.stops[k];
            if (stop === undefined) return null;
            const here = node.level === progress.level;
            return (
              <li
                key={node.level}
                id={`niveau-${node.level}`}
                className={styles.stop}
                data-state={here && node.state !== "claimable" ? "here" : node.state}
                data-milestone={node.milestone || undefined}
                data-side={stop.side}
                style={{ "--x": `${stop.x}%`, top: k * ROAD_ROW } as CSSProperties}
              >
                {node.milestone && (
                  <span className={styles.flag} aria-hidden="true">
                    <ToyIcon name="community" size={40} inks={toyIconInks.album} />
                  </span>
                )}
                <button
                  type="button"
                  className={styles.stopButton}
                  aria-label={node.label}
                  aria-pressed={node.level === chosen}
                  aria-expanded={node.level === bubble}
                  onClick={() => onPick(node)}
                >
                  <StopToken node={node} progress={progress} me={me} />
                </button>
                <span className={styles.tag} data-chosen={node.level === chosen || undefined}>
                  <RewardToy icon={node.icon} size={26} dim={node.fog} />
                  <span>{node.tag}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div
          className={styles.end}
          style={{ left: `${road.end.x}%`, top: road.end.y } as CSSProperties}
        >
          {end}
        </div>
        {bubble !== null && open !== -1 && (
          <div
            className={styles.bubble}
            data-above={above || undefined}
            style={
              {
                "--x": `${road.stops[open]?.x ?? 50}%`,
                [above ? "bottom" : "top"]: above
                  ? road.height - open * ROAD_ROW - 6
                  : (open + 1) * ROAD_ROW - 6,
              } as CSSProperties
            }
          >
            <Detail
              level={bubble}
              progress={progress}
              claimed={claimed}
              now={now}
              onCoffret={onCoffret}
            />
          </div>
        )}
      </div>
      {after}
    </div>
  );
}

function StopToken({
  node,
  progress,
  me,
}: {
  readonly node: RoadNode;
  readonly progress: Progress;
  readonly me: Me;
}) {
  if (node.level === progress.level) {
    return (
      <span className={styles.here}>
        <span className={styles.sparkles} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <LevelMedal level={node.level} size={node.milestone ? 78 : 70} />
        {/* The player stands on their own level, as a piece on a board. */}
        <span className={styles.me}>
          <Avatar avatar={me.avatar} frame={me.frame} size={30} />
        </span>
        {node.state === "claimable" && (
          <span className={`${styles.hereChest} ${styles.hop}`}>
            <ToyIcon name="chest" size={34} />
          </span>
        )}
      </span>
    );
  }
  if (node.state === "claimable") {
    return (
      <span className={`${styles.chest} ${styles.hop}`}>
        <ToyIcon name="chest" size={node.milestone ? 66 : 56} />
        <ToyBody matter="red" shape="tag" className={styles.chestNumber}>
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

/** Where the road leaves the chapter: a sign to the next one, closed until it shows. */
function ChapterSignpost({
  name,
  note,
  open,
  onShow,
}: {
  readonly name: string;
  readonly note: string;
  readonly open: boolean;
  readonly onShow: () => void;
}) {
  return (
    <Toy
      matter={open ? "paper" : "locked"}
      className={styles.sign}
      disabled={!open}
      onClick={onShow}
    >
      <ToyIcon name={open ? "community" : "lock"} size={30} />
      <span className={styles.signText}>
        <span className={styles.signKicker}>Chapitre suivant</span>
        <strong>{name}</strong>
        <span className={styles.signNote}>{note}</span>
      </span>
      {open && <Icon name="chevd" size={18} />}
    </Toy>
  );
}

/** What a level gives, as toys with their words, and its button when its coffret waits. */
function Detail({
  level,
  progress,
  claimed,
  now,
  onCoffret,
}: {
  readonly level: number;
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
  readonly onCoffret: (level: number) => void;
}) {
  const detail = levelDetail(level, progress, claimed, now);
  return (
    <section className={`${ui.leaf} ${styles.detail}`} aria-live="polite">
      <span className={desk.leafKicker}>Niveau {detail.level}</span>
      <h2 className={styles.detailTitle}>{detail.title}</h2>
      <ul className={styles.items}>
        {detail.items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list; two rewards may be alike
          <li key={`${item.title}-${index}`} className={styles.item}>
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
      {detail.state === "claimable" && (
        <MainAction label="Ouvrir le coffret" onClick={() => onCoffret(detail.level)} />
      )}
      {detail.state === "claimed" && (
        <p className={styles.done}>
          <Icon name="check" size={18} />
          Coffret ouvert
        </p>
      )}
      {detail.xpLeft !== null && <p className={styles.left}>{detail.xpLeft}</p>}
    </section>
  );
}

/** The parts of the game still closed, each with the level that opens it. */
function Unlocks({ level, now }: { readonly level: number; readonly now: number }) {
  const ahead = unlocksAhead(level, now);
  if (ahead.length === 0) return null;
  return (
    <section className={`${ui.leaf} ${styles.unlocks}`}>
      <span className={desk.leafKicker}>À débloquer</span>
      <ul className={styles.unlockList}>
        {ahead.map((unlock) => (
          <li key={unlock.level} className={styles.unlock}>
            <span className={styles.unlockToy}>
              <ToyIcon name="lock" size={38} />
              <ToyBody matter="dark" shape="tag" className={styles.unlockLevel}>
                <Lettering>{unlock.level}</Lettering>
              </ToyBody>
            </span>
            <span>
              {unlock.text}
              <span className={styles.unlockAt}>Au niveau {unlock.level}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

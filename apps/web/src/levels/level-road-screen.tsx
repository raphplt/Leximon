"use client";

import {
  levelDetail,
  type PlateauLayout,
  plateauLayout,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  type RoadNode,
  roadSubtitle,
  xpSources,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";
import { levelRewards } from "@/player/player";
import { useSharedFailed } from "@/player/resource";
import { retryProgress, useProgressFailed } from "@/progress/use-progress";
import { REWARD_ICONS } from "@/shell/reward-icons";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { LoadFailed } from "@/ui/load-failed";
import ui from "@/ui/ui.module.css";
import styles from "./level-road.module.css";
import { PlateauDecor, TileBlock } from "./plateau-art";

/** Quarters the player may look at beyond their own. */
const QUARTERS_AHEAD = 2;

/** A level asked for in the address (`#niveau-12`, from the next rewards of Jouer). */
function levelFromHash(): number | null {
  const match = /^#niveau-(\d+)$/.exec(window.location.hash);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** The level road, ten levels at a time: tiles climbing a plateau, the fog ahead. */
export function LevelRoadScreen() {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const [selected, setSelected] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const { progress, now, claimed } = view;
  const progressFailed = useProgressFailed();
  const rewardsFailed = useSharedFailed(levelRewards);

  useEffect(() => {
    const asked = levelFromHash();
    if (asked === null) return;
    setSelected(asked);
    setShown(quarterOfLevel(asked).index);
  }, []);

  if ((progress === null && progressFailed) || (claimed === null && rewardsFailed)) {
    return (
      <main className={styles.page}>
        <Header subtitle={null} />
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
        <Header subtitle={null} />
        <div className={`${styles.board} ${styles.loading}`} />
      </main>
    );
  }

  const own = quarterOfLevel(progress.level);
  const last = own.index + QUARTERS_AHEAD;
  const quarter = quarterAt(Math.min(last, shown ?? own.index));
  const nodes = quarterNodes(quarter, progress.level, claimed, now);
  const layout = plateauLayout(
    nodes.map((n) => n.level),
    progress.level,
  );
  const chosen = selected ?? view.coffrets[0] ?? progress.level + 1;
  const detail = levelDetail(chosen, progress, claimed, now);

  const pick = (node: RoadNode) => {
    setSelected(node.level);
    if (node.state === "claimable") openCoffret(node.level);
  };

  return (
    <main className={styles.page}>
      <Header subtitle={roadSubtitle(progress)} />
      <div className={styles.layout}>
        <section className={styles.board} aria-label={`${quarter.name}, ${quarter.range}`}>
          <div className={styles.boardHead}>
            <button
              type="button"
              className={ui.round}
              aria-label="Quartier précédent"
              disabled={quarter.index === 1}
              onClick={() => setShown(quarter.index - 1)}
            >
              <Icon name="back" size={18} />
            </button>
            <div className={styles.quarterName}>
              <span className={styles.quarterRange}>{quarter.range}</span>
              <h2 className={`${ui.display} ${styles.quarterTitle}`}>{quarter.name}</h2>
            </div>
            <button
              type="button"
              className={ui.round}
              aria-label="Quartier suivant"
              disabled={quarter.index >= last}
              onClick={() => setShown(quarter.index + 1)}
            >
              <Icon name="chev" size={18} />
            </button>
          </div>
          <Plateau
            nodes={nodes}
            layout={layout}
            level={progress.level}
            chosen={chosen}
            onPick={pick}
          />
        </section>

        <div className={styles.side}>
          <section className={`${ui.panel} ${styles.detail}`} aria-live="polite">
            <p className={ui.kicker}>Niveau {detail.level}</p>
            <h2 className={`${ui.display} ${styles.detailTitle}`}>{detail.title}</h2>
            <ul className={styles.items}>
              {detail.items.map((item) => (
                <li key={item.title} className={styles.item}>
                  <span className={styles.itemIcon}>
                    <Icon name={REWARD_ICONS[item.icon]} size={22} />
                  </span>
                  <span>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemDetail}>{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {detail.opens !== null && (
              <div className={styles.opensBox}>
                <p className={`${ui.kicker} ${styles.opensKicker}`}>Débloque</p>
                <p className={styles.opensText}>{detail.opens}</p>
              </div>
            )}
            <div className={styles.detailAction}>
              {detail.state === "claimable" && (
                <Button wide glow onClick={() => openCoffret(detail.level)}>
                  Ouvrir le coffret
                </Button>
              )}
              {detail.state === "claimed" && (
                <p className={styles.done}>
                  <Icon name="check" size={18} />
                  Coffret ouvert
                </p>
              )}
              {detail.xpLeft !== null && <p className={styles.left}>{detail.xpLeft}</p>}
            </div>
          </section>

          <Quarters own={own} last={last} shown={quarter} onShow={setShown} />

          <section className={`${ui.panel} ${styles.xpTable}`}>
            <h2 className={ui.kicker}>D'où vient l'XP</h2>
            <dl className={styles.sources}>
              {xpSources(now).map((source) => (
                <div key={source.action} className={styles.source}>
                  <dt>{source.action}</dt>
                  <dd>{source.xp}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}

/** Share of the plateau's width or height, for a position that scales with it. */
function share(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function Plateau({
  nodes,
  layout,
  level,
  chosen,
  onPick,
}: {
  readonly nodes: readonly RoadNode[];
  readonly layout: PlateauLayout;
  readonly level: number;
  readonly chosen: number;
  readonly onPick: (node: RoadNode) => void;
}) {
  const { width, height, tile } = layout;
  const fogged = layout.points.filter((_, index) => nodes[index]?.fog === true);
  // The fog reaches down to the lowest tile it hides.
  const fogLine = fogged.length === 0 ? null : Math.max(...fogged.map((p) => p.y)) + tile.height;
  const here = layout.points.find((p) => p.level === level);
  return (
    <div className={styles.plateau} style={{ aspectRatio: `${width} / ${height}` }}>
      <PlateauDecor layout={layout} />
      <ol className={styles.tiles}>
        {/* Highest first: a tile lower on the screen stands in front of the ones above it. */}
        {[...nodes].reverse().map((node) => {
          const point = layout.points.find((p) => p.level === node.level);
          if (point === undefined) return null;
          return (
            <li key={node.level} id={`niveau-${node.level}`}>
              <button
                type="button"
                className={`${styles.tile} ${node.fog ? styles.fog : ""}`}
                style={
                  {
                    left: share(point.x - tile.width / 2, width),
                    top: share(point.y - tile.height / 2, height),
                    width: share(tile.width, width),
                    height: share(tile.height + tile.depth, height),
                  } as CSSProperties
                }
                aria-label={node.label}
                aria-pressed={node.level === chosen}
                onClick={() => onPick(node)}
              >
                <TileBlock look={tileLook(node)} glow={node.state === "claimable"} />
                <span className={styles.tileFace}>
                  <TileMark node={node} last={node === nodes[nodes.length - 1]} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {fogLine !== null && (
        <div
          className={styles.fogBank}
          style={{ height: share(fogLine, height) }}
          aria-hidden="true"
        />
      )}
      {here !== undefined && (
        <span
          className={styles.here}
          style={{ left: share(here.x, width), top: share(here.y - tile.height / 2, height) }}
          aria-hidden="true"
        >
          <LevelMedal level={level} size={52} />
        </span>
      )}
    </div>
  );
}

type TileLook = "gold" | "cream" | "kraft" | "slate";

function tileLook(node: RoadNode): TileLook {
  if (node.state === "claimed" || node.state === "claimable") return "gold";
  if (node.milestone) return "kraft";
  return node.state === "next" ? "cream" : "slate";
}

function TileMark({ node, last }: { readonly node: RoadNode; readonly last: boolean }) {
  if (node.state === "claimed") return <Icon name="check" size={22} />;
  if (node.state === "claimable" || last) return <Icon name="coffret" size={22} />;
  return <span className={ui.display}>{node.level}</span>;
}

function Quarters({
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
    <section className={`${ui.panel} ${styles.quarters}`}>
      <h2 className={ui.kicker}>Les quartiers</h2>
      <ol className={styles.quarterList}>
        {quarters.map((q) => (
          <li key={q.index}>
            <button
              type="button"
              className={styles.quarter}
              aria-current={q.index === shown.index ? "true" : undefined}
              onClick={() => onShow(q.index)}
            >
              <span
                className={
                  q.index < own.index
                    ? styles.quarterDone
                    : q.index === own.index
                      ? styles.quarterHere
                      : styles.quarterAhead
                }
              >
                {q.index < own.index ? <Icon name="check" size={14} /> : q.index}
              </span>
              <span className={styles.quarterLabel}>{q.name}</span>
              <span className={styles.quarterLevels}>
                {q.first} à {q.last}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Header({ subtitle }: { readonly subtitle: string | null }) {
  return (
    <header className={styles.header}>
      <Link href="/jouer" className={ui.round} aria-label="Retour">
        <Icon name="back" size={20} />
      </Link>
      <div>
        <h1 className={`${ui.display} ${styles.title}`}>Niveaux</h1>
        <p className={styles.subtitle}>{subtitle ?? "\u00a0"}</p>
      </div>
    </header>
  );
}

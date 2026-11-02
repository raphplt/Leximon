"use client";

import type { Progress } from "@leximon/contract";
import {
  levelDetail,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  type RoadNode,
  roadSubtitle,
  xpSources,
} from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useState } from "react";
import { levelRewards } from "@/player/player";
import { useSharedFailed } from "@/player/resource";
import { retryProgress, useProgressFailed } from "@/progress/use-progress";
import { REWARD_ICONS } from "@/shell/reward-icons";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level-bits";
import { LoadFailed } from "@/ui/load-failed";
import ui from "@/ui/ui.module.css";
import styles from "./level-road.module.css";

/** Chapters the player may look at beyond their own. */
const QUARTERS_AHEAD = 2;

/** A level asked for in the address (`#niveau-12`, from the next rewards of Jouer). */
function levelFromHash(): number | null {
  const match = /^#niveau-(\d+)$/.exec(window.location.hash);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** The levels, ten at a time: a page of contents, each line a level and what it gives. */
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
        <div className={`${styles.folio} ${styles.loading}`} />
      </main>
    );
  }

  const own = quarterOfLevel(progress.level);
  const last = own.index + QUARTERS_AHEAD;
  const quarter = quarterAt(Math.min(last, shown ?? own.index));
  const nodes = quarterNodes(quarter, progress.level, claimed, now);
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
        <section
          className={styles.folio}
          aria-label={`${quarter.name}, ${quarter.range}`}
          data-paper=""
        >
          <div className={styles.folioHead}>
            <button
              type="button"
              className={`${styles.turn} ${ui.paperToy}`}
              aria-label="Chapitre précédent"
              disabled={quarter.index === 1}
              onClick={() => setShown(quarter.index - 1)}
            >
              <Icon name="back" size={18} />
            </button>
            <div className={styles.quarterName}>
              <span className={styles.quarterRange}>
                {quarter.chapter} · {quarter.range}
              </span>
              <h2 className={`${ui.display} ${styles.quarterTitle}`}>{quarter.name}</h2>
            </div>
            <button
              type="button"
              className={`${styles.turn} ${ui.paperToy}`}
              aria-label="Chapitre suivant"
              disabled={quarter.index >= last}
              onClick={() => setShown(quarter.index + 1)}
            >
              <Icon name="chev" size={18} />
            </button>
          </div>
          <ol className={styles.lines}>
            {nodes.map((node) => (
              <li key={node.level} id={`niveau-${node.level}`}>
                <Line
                  node={node}
                  progress={progress}
                  chosen={node.level === chosen}
                  onPick={() => pick(node)}
                />
              </li>
            ))}
          </ol>
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

/** A line of the contents: what the level gives, then its number across the dots. */
function Line({
  node,
  progress,
  chosen,
  onPick,
}: {
  readonly node: RoadNode;
  readonly progress: Progress;
  readonly chosen: boolean;
  readonly onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.line}
      data-state={node.state}
      data-milestone={node.milestone}
      aria-label={node.label}
      aria-pressed={chosen}
      onClick={onPick}
    >
      <span className={styles.lineMark}>
        <LineMark node={node} level={progress.level} />
      </span>
      <span className={styles.lineText}>
        <span className={styles.lineTitle}>{node.summary}</span>
        {node.opensLine !== null && <span className={styles.lineOpens}>{node.opensLine}</span>}
        {node.state === "next" && (
          <XpBar
            thin
            className={styles.lineBar}
            ratio={progress.xpIntoLevel / progress.xpForNextLevel}
          />
        )}
      </span>
      <span className={styles.leader} aria-hidden="true" />
      {node.state === "claimable" && <span className={styles.toOpen}>À ouvrir</span>}
      <span className={`${ui.display} ${styles.lineLevel}`}>{node.level}</span>
    </button>
  );
}

function LineMark({ node, level }: { readonly node: RoadNode; readonly level: number }) {
  if (node.level === level) return <LevelMedal level={level} size={34} />;
  if (node.state === "claimed") return <Icon name="check" size={18} />;
  if (node.state === "claimable") return <Icon name="coffret" size={20} />;
  return null;
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
      <h2 className={ui.kicker}>Les chapitres</h2>
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

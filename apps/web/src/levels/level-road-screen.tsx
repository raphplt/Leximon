"use client";

import {
  levelDetail,
  type RoadNode,
  roadLayout,
  roadNodes,
  roadSubtitle,
  xpSources,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useNarrow } from "@/lib/use-narrow";
import { REWARD_ICONS } from "@/shell/reward-icons";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./level-road.module.css";

const WIDE = { width: 520, rowHeight: 104, amplitude: 165, height: 700, label: 190 };
const NARROW = { width: 340, rowHeight: 92, amplitude: 100, height: 470, label: 120 };

/** A level asked for in the address (`#niveau-12`, from the next rewards of Jouer). */
function levelFromHash(): number | null {
  const match = /^#niveau-(\d+)$/.exec(window.location.hash);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** The level road (N-01 to N-04): every level, what it gives, what it opens. */
export function LevelRoadScreen() {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const narrow = useNarrow();
  const size = narrow ? NARROW : WIDE;
  const [selected, setSelected] = useState<number | null>(null);
  const road = useRef<HTMLDivElement>(null);
  const centered = useRef(false);
  const { progress, now } = view;
  const { claimed } = view;

  useEffect(() => {
    setSelected((current) => current ?? levelFromHash());
  }, []);

  const ready = progress !== null && claimed !== null && now > 0;
  const nodes = ready ? roadNodes(progress.level, claimed, now) : [];
  const layout = ready
    ? roadLayout(
        nodes.map((n) => n.level),
        progress.level,
        size,
      )
    : null;

  // Once drawn, the road opens on the player's level.
  useEffect(() => {
    if (!ready || centered.current || road.current === null || layout === null) return;
    centered.current = true;
    const index = nodes.findIndex((n) => n.level === (selected ?? progress.level));
    road.current.scrollTop = Math.max(
      0,
      index * size.rowHeight - size.height / 2 + size.rowHeight / 2,
    );
  });

  if (!ready || layout === null) {
    return (
      <main className={styles.page}>
        <Header subtitle={null} />
        <div
          className={`${ui.panel} ${styles.road} ${styles.loading}`}
          style={{ height: size.height }}
        />
      </main>
    );
  }

  const chosen = selected ?? view.coffrets[0] ?? progress.level + 1;
  const detail = levelDetail(chosen, progress, claimed, now);
  const cardWaits = view.cardChoices.includes(chosen);

  const pick = (node: RoadNode) => {
    setSelected(node.level);
    if (node.state === "claimable") openCoffret(node.level);
  };

  return (
    <main className={styles.page}>
      <Header subtitle={roadSubtitle(progress)} />
      <div className={styles.layout}>
        <div ref={road} className={`${ui.panel} ${styles.road}`} style={{ height: size.height }}>
          <div className={styles.track} style={{ width: layout.width, height: layout.height }}>
            <svg
              width={layout.width}
              height={layout.height}
              aria-hidden="true"
              className={styles.svg}
            >
              <path d={layout.path} className={styles.pathEdge} />
              <path d={layout.path} className={styles.pathBase} />
              <path d={layout.donePath} className={styles.pathDone} />
              <path d={layout.path} className={styles.pathDots} />
            </svg>
            <ol className={styles.nodes}>
              {nodes.map((node, index) => {
                const point = layout.points[index];
                if (point === undefined) return null;
                const nodeSize = node.milestone ? 70 : 58;
                const right = point.x > layout.width / 2 + 5;
                return (
                  <li key={node.level} id={`niveau-${node.level}`}>
                    <button
                      type="button"
                      className={`${styles.node} ${styles[node.state]} ${node.milestone ? styles.milestone : ""} ${node.state === "claimable" ? ui.glow : ""}`}
                      style={
                        {
                          left: point.x - nodeSize / 2,
                          top: point.y - nodeSize / 2,
                          width: nodeSize,
                          height: nodeSize,
                        } as CSSProperties
                      }
                      aria-label={node.label}
                      aria-pressed={node.level === chosen}
                      onClick={() => pick(node)}
                    >
                      {node.state === "claimed" ? (
                        <Icon name="check" size={node.milestone ? 30 : 24} />
                      ) : node.state === "claimable" ? (
                        <Icon name="coffret" size={node.milestone ? 30 : 24} />
                      ) : (
                        <span className={ui.display} style={{ fontSize: node.milestone ? 26 : 21 }}>
                          {node.level}
                        </span>
                      )}
                    </button>
                    <div
                      className={styles.label}
                      style={
                        {
                          top: point.y - 24,
                          width: size.label,
                          left: right
                            ? point.x - nodeSize / 2 - 14 - size.label
                            : point.x + nodeSize / 2 + 14,
                          textAlign: right ? "right" : "left",
                          opacity: node.state === "locked" ? 0.75 : 1,
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    >
                      <div className={styles.labelLevel}>NIVEAU {node.level}</div>
                      <div className={styles.labelText}>{node.summary}</div>
                      {node.opens !== null && (
                        <div className={styles.opens}>Ouvre : {node.opens.toLowerCase()}</div>
                      )}
                    </div>
                    {node.level === progress.level && (
                      // On the side away from the label, which it would cover.
                      <span
                        className={styles.pin}
                        style={{
                          left: point.x + (right ? nodeSize / 2 - 18 : -nodeSize / 2 - 22),
                          top: point.y - nodeSize / 2 - 22,
                        }}
                        aria-hidden="true"
                      >
                        <Icon name="profil" size={22} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className={styles.side}>
          <section className={`${ui.panel} ${ui.enter} ${styles.detail}`} aria-live="polite">
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
                <p className={`${ui.kicker} ${styles.opensKicker}`}>Ouvre</p>
                <p className={styles.opensText}>{detail.opens}</p>
              </div>
            )}
            <div className={styles.detailAction}>
              {detail.state === "claimable" && (
                <Button wide glow onClick={() => openCoffret(detail.level)}>
                  Ouvrir le coffret
                </Button>
              )}
              {detail.state === "claimed" &&
                (cardWaits ? (
                  <ButtonLink href="/niveaux/carte" wide>
                    Choisir ma carte
                  </ButtonLink>
                ) : (
                  <p className={styles.done}>
                    <Icon name="check" size={18} />
                    Réclamée
                  </p>
                ))}
              {detail.xpLeft !== null && <p className={styles.left}>{detail.xpLeft}</p>}
            </div>
          </section>
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

function Header({ subtitle }: { readonly subtitle: string | null }) {
  return (
    <header className={styles.header}>
      <Link href="/jouer" className={ui.round} aria-label="Retour">
        <Icon name="back" size={20} />
      </Link>
      <div>
        <h1 className={`${ui.display} ${styles.title}`}>Chemin des niveaux</h1>
        <p className={styles.subtitle}>{subtitle ?? " "}</p>
      </div>
    </header>
  );
}

"use client";

import type { Rarity } from "@leximon/core";
import { cssFill, rarityStyles } from "@leximon/tokens";
import {
  type AlbumFilter,
  type AlbumItem,
  type AlbumState,
  albumView,
  type MissingItem,
  type OwnedItem,
  shortName,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { type Catalog, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { RarityIcon, RarityName } from "@/components/rarity-icon";
import { useIncremental } from "@/lib/use-incremental";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { ownedCards, wordMemory } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./album-screen.module.css";

/** Tone of each launch collection's progress bar, as on the maquette. */
const TONES: Readonly<Record<string, string>> = {
  fondateurs: "#7C9BFF",
  caracteres: "#FF8462",
  metiers: "#3BD3A5",
};

const STORED_COLLECTION = "leximon.album";

/** Tiles drawn per batch: a full collection at once is hundreds of cards. */
const BATCH = 48;

function readCollection(): string | null {
  try {
    return localStorage.getItem(STORED_COLLECTION);
  } catch {
    return null;
  }
}

function writeCollection(id: string): void {
  try {
    localStorage.setItem(STORED_COLLECTION, id);
  } catch {
    // Not remembered: the album opens on the first collection next time.
  }
}

/** The album (A-01 to A-06): collection tabs, rarity and filters, the grid of cards. */
export function AlbumScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const now = useNow(60_000);
  const narrow = useNarrow();
  const { openCard } = useShell();
  const [state, setState] = useState<AlbumState>({
    collectionId: "",
    rarity: null,
    filter: "all",
    theme: null,
    search: "",
  });

  const load = () => {
    setFailed(false);
    loadCatalog()
      .then((loaded) => {
        setCatalog(loaded);
        const stored = readCollection();
        const first = loaded.collections.find((c) => c.id === stored) ?? loaded.collections[0];
        if (first !== undefined) setState((s) => ({ ...s, collectionId: first.id }));
      })
      .catch(() => setFailed(true));
  };

  useEffect(load, []);

  const view = useMemo(
    () =>
      catalog === null || owned === null
        ? null
        : albumView(
            { collections: catalog.collections, owned, memory: memory ?? new Map(), now },
            state,
          ),
    [catalog, owned, memory, now, state],
  );
  const { shown, sentinel } = useIncremental(view?.items.length ?? 0, BATCH, JSON.stringify(state));

  if (failed) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Le catalogue ne répond pas.</p>
        <Button variant="secondary" onClick={load}>
          Réessayer
        </Button>
      </main>
    );
  }

  if (view === null) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Un instant…</p>
      </main>
    );
  }

  const pickCollection = (id: string) => {
    writeCollection(id);
    setState((s) => ({ ...s, collectionId: id, rarity: null, theme: null, search: "" }));
  };
  const cardWidth = narrow ? 104 : 168;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={`${ui.display} ${styles.title}`}>Album</h1>
          <p className={styles.headline}>
            <strong>{view.headline.owned}</strong> mots sur {view.headline.total}
          </p>
        </div>
        <label className={styles.search}>
          <span className={styles.searchIcon}>
            <Icon name="search" size={18} />
          </span>
          <span className={styles.hidden}>Chercher un mot</span>
          <input
            className={styles.input}
            type="search"
            placeholder="Chercher un mot"
            value={state.search}
            onChange={(event) => setState((s) => ({ ...s, search: event.target.value }))}
          />
        </label>
      </header>

      <div
        className={`${styles.tabs} ${view.searching ? styles.dimmed : ""}`}
        role="tablist"
        aria-label="Collections"
      >
        {view.tabs.map((tab) => {
          const selected = !view.searching && tab.id === state.collectionId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={styles.tab}
              onClick={() => pickCollection(tab.id)}
            >
              <span className={styles.tabHead}>
                <span className={styles.tabName}>{narrow ? shortName(tab.name) : tab.name}</span>
                <span className={styles.tabCount}>{tab.count}</span>
              </span>
              <span className={styles.tabTrack}>
                <span
                  className={styles.tabFill}
                  style={{
                    width: `${Math.round(tab.ratio * 100)}%`,
                    background: TONES[tab.id] ?? "var(--lx-color-accent)",
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {!view.searching && (
        <>
          <div className={styles.row}>
            {view.rarities.map((chip) => (
              <RarityChip
                key={chip.rarity}
                rarity={chip.rarity}
                count={chip.count}
                aria={chip.aria}
                on={state.rarity === chip.rarity}
                onPick={() =>
                  setState((s) => ({ ...s, rarity: s.rarity === chip.rarity ? null : chip.rarity }))
                }
              />
            ))}
          </div>
          <div className={styles.row}>
            {view.filters.map((filter) => (
              <FilterChip
                key={filter.id}
                label={filter.label}
                on={state.filter === filter.id}
                onPick={() => setState((s) => ({ ...s, filter: filter.id as AlbumFilter }))}
              />
            ))}
            <span className={styles.divider} aria-hidden="true" />
            {view.themes.map((theme) => (
              <FilterChip
                key={theme.id}
                label={theme.label}
                on={state.theme === theme.id}
                muted
                onPick={() =>
                  setState((s) => ({ ...s, theme: s.theme === theme.id ? null : theme.id }))
                }
              />
            ))}
          </div>
        </>
      )}

      {view.empty !== null ? (
        <p className={styles.empty}>
          <em>{view.empty}</em>
        </p>
      ) : (
        <>
          <ul
            className={styles.grid}
            style={{ "--card": `${cardWidth}px` } as CSSProperties}
            aria-label="Cartes"
          >
            {view.items.slice(0, shown).map((item) => (
              <li key={itemKey(item)} className={styles.slot}>
                <Tile item={item} width={cardWidth} onOpen={openCard} />
              </li>
            ))}
          </ul>
          {shown < view.items.length && <div ref={sentinel} aria-hidden="true" />}
        </>
      )}
    </main>
  );
}

function itemKey(item: AlbumItem): string {
  if (item.kind === "owned") return item.card.id;
  if (item.kind === "missing") return `missing-${item.cardId}`;
  return "more";
}

function Tile({
  item,
  width,
  onOpen,
}: {
  readonly item: AlbumItem;
  readonly width: number;
  readonly onOpen: (cardId: string) => void;
}) {
  switch (item.kind) {
    case "owned":
      return <OwnedTile item={item} width={width} onOpen={onOpen} />;
    case "missing":
      return <MissingTile item={item} />;
    case "more":
      return (
        <Link href="/jouer" className={styles.more}>
          <span className={`${ui.display} ${styles.moreCount}`}>{item.left}</span>
          <span className={styles.moreLabel}>{item.label}</span>
        </Link>
      );
  }
}

function OwnedTile({
  item,
  width,
  onOpen,
}: {
  readonly item: OwnedItem;
  readonly width: number;
  readonly onOpen: (cardId: string) => void;
}) {
  return (
    <button
      type="button"
      className={styles.owned}
      onClick={() => onOpen(item.card.id)}
      aria-label={item.aria}
    >
      <Card card={item.card} collectionName={item.collectionName} width={width} />
      {item.quantity > 1 && <span className={styles.quantity}>×{item.quantity}</span>}
      <span className={`${styles.mastery} ${styles[item.level]}`}>
        <span className={styles.dot} />
        {item.levelLabel}
      </span>
    </button>
  );
}

/** A card not found yet: only its rarity shows, the word stays a surprise. */
function MissingTile({ item }: { readonly item: MissingItem }) {
  const style = rarityStyles[item.rarity];
  const frame = typeof style.frame === "string" ? style.frame : cssFill(style.frame);
  return (
    <div className={styles.missing} role="img" aria-label={item.aria}>
      <span className={styles.missingBox} style={{ "--frame": frame } as CSSProperties}>
        <span className={`${ui.display} ${styles.question}`} aria-hidden="true">
          ?
        </span>
      </span>
      <span className={styles.missingLabel}>
        <RarityName rarity={item.rarity} />
      </span>
    </div>
  );
}

function RarityChip({
  rarity,
  count,
  aria,
  on,
  onPick,
}: {
  readonly rarity: Rarity;
  readonly count: string;
  readonly aria: string;
  readonly on: boolean;
  readonly onPick: () => void;
}) {
  const style = rarityStyles[rarity];
  return (
    <button
      type="button"
      className={`${ui.chip} ${styles.rarityChip}`}
      aria-pressed={on}
      aria-label={aria}
      onClick={onPick}
    >
      <span
        className={styles.gem}
        style={{ background: cssFill(style.band), color: style.bandInk }}
        aria-hidden="true"
      >
        <RarityIcon rarity={rarity} size="16px" />
      </span>
      <span className={styles.num}>{count}</span>
    </button>
  );
}

function FilterChip({
  label,
  on,
  muted = false,
  onPick,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly muted?: boolean;
  readonly onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${ui.chip} ${styles.filter} ${muted ? styles.theme : ""}`}
      data-on={on}
      aria-pressed={on}
      onClick={onPick}
    >
      {label}
    </button>
  );
}

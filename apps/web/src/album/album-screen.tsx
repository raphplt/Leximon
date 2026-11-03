"use client";

import type { Catalog } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt, type Rarity } from "@leximon/core";
import { collectionTone, cssFill, rarityStyles } from "@leximon/tokens";
import {
  ALBUM_SORT_LABELS,
  ALBUM_SORT_TITLE,
  ALBUM_SORTS,
  ALBUM_THEME_TEXTS,
  ALL_COLLECTIONS,
  type AlbumFilter,
  type AlbumItem,
  type AlbumSort,
  type AlbumState,
  albumPracticeCards,
  albumView,
  type CompareFilter,
  compareFilters,
  comparingTitle,
  isAlbumSort,
  isFeatureOpen,
  type MissingItem,
  type OwnedItem,
  playerName,
  shortName,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { packOf } from "@/booster/pack-looks";
import { loadCatalog } from "@/cards/catalog";
import { askAlbumPractice } from "@/challenges/pending-practice";
import { Card } from "@/components/card";
import { CollectionSeal } from "@/components/collection-seal";
import { RarityIcon, RarityName } from "@/components/rarity-icon";
import { api } from "@/lib/api";
import { useIncremental } from "@/lib/use-incremental";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { Desk } from "@/library/play-pieces";
import { cardDates, ownedCards, wordMemory } from "@/player/collection";
import { useShared, useSharedFailed } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import styles from "./album-screen.module.css";

const STORED_COLLECTION = "leximon.album";
const STORED_SORT = "leximon.album.sort";

/** Tiles drawn per batch: a full collection at once is hundreds of cards. */
const BATCH = 48;

function readCollection(): string | null {
  try {
    return localStorage.getItem(STORED_COLLECTION);
  } catch {
    return null;
  }
}

function readSort(): AlbumSort {
  try {
    const stored = localStorage.getItem(STORED_SORT);
    return isAlbumSort(stored) ? stored : "alpha";
  } catch {
    return "alpha";
  }
}

function writeSort(sort: AlbumSort): void {
  try {
    localStorage.setItem(STORED_SORT, sort);
  } catch {
    // Not remembered: the album opens from A to Z next time.
  }
}

function writeCollection(id: string): void {
  try {
    localStorage.setItem(STORED_COLLECTION, id);
  } catch {
    // Not remembered: the album opens on the first collection next time.
  }
}

/** The album: collection tabs, rarity and filters, the grid of cards. */
export function AlbumScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const owned = useShared(ownedCards);
  const ownedFailed = useSharedFailed(ownedCards);
  const memory = useShared(wordMemory);
  const dates = useShared(cardDates);
  const now = useNow(60_000);
  const narrow = useNarrow();
  const { openCard } = useShell();
  const progress = useProgress();
  const [state, setState] = useState<AlbumState>({
    collectionId: "",
    rarity: null,
    filter: "all",
    theme: null,
    search: "",
    compare: null,
  });
  // `/album?ami=<code>`: a friend's album beside the player's.
  const friendCode = useSearchParams().get("ami");
  const router = useRouter();
  const [friend, setFriend] = useState<{
    readonly name: string;
    readonly cards: ReadonlySet<string>;
  } | null>(null);

  useEffect(() => {
    setFriend(null);
    setState((s) => ({ ...s, compare: null }));
    if (friendCode === null) return;
    let live = true;
    api
      .fetchFriendCards(friendCode)
      .then((found) => {
        if (!live || found === null) return;
        setFriend({ name: playerName(found.player), cards: new Set(found.cardIds) });
        setState((s) => ({ ...s, compare: "theirs" }));
      })
      .catch(() => {
        // The player's own album stays, without the comparison.
      });
    return () => {
      live = false;
    };
  }, [friendCode]);

  const load = () => {
    setFailed(false);
    loadCatalog()
      .then((loaded) => {
        setCatalog(loaded);
        // The tab chosen last time if it still exists, else every collection.
        const stored = readCollection();
        const kept = loaded.collections.some((c) => c.id === stored) ? stored : null;
        setState((s) => ({ ...s, collectionId: kept ?? ALL_COLLECTIONS, sort: readSort() }));
      })
      .catch(() => setFailed(true));
  };

  useEffect(load, []);

  const view = useMemo(
    () =>
      catalog === null || owned === null
        ? null
        : albumView(
            {
              collections: catalog.collections,
              owned,
              memory: memory ?? new Map(),
              dates: dates ?? new Map(),
              now,
              ...(friend === null ? {} : { friend: friend.cards }),
            },
            state,
          ),
    [catalog, owned, memory, dates, now, state, friend],
  );
  // The sheet turns through the cards the album shows, in its order.
  const ownedIds = useMemo(
    () => view?.items.flatMap((item) => (item.kind === "owned" ? [item.card.id] : [])) ?? [],
    [view],
  );
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const resetKey = JSON.stringify(state);
  const { shown, sentinel, reach } = useIncremental(
    view?.items.length ?? 0,
    BATCH,
    resetKey,
    scroller,
  );
  // Another filter or sort starts the cards over from the top of their box.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the reason to run
  useEffect(() => {
    scroller?.scrollTo({ top: 0 });
  }, [resetKey, scroller]);
  /** A letter of the bar: its first card, drawn if it was not yet, at the top of the box. */
  const [jump, setJump] = useState<number | null>(null);
  const jumpTo = (index: number) => {
    reach(index);
    setJump(index);
  };
  useEffect(() => {
    if (jump === null || scroller === null || shown <= jump) return;
    const target = scroller.querySelector<HTMLElement>(`[data-index="${jump}"]`);
    if (target !== null) scroller.scrollTo({ top: target.offsetTop - 8 });
    setJump(null);
  }, [jump, shown, scroller]);
  const [themesOpen, setThemesOpen] = useState(false);
  const sort = state.sort ?? "alpha";
  const pickSort = (next: AlbumSort) => {
    writeSort(next);
    setState((s) => ({ ...s, sort: next }));
  };
  const cardWidth = narrow ? 100 : 168;
  const tagline = catalog?.collections.find((c) => c.id === state.collectionId)?.tagline;
  const pickedTheme = view?.themes.find((theme) => theme.id === state.theme);

  if (failed) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Les cartes n'ont pas pu être chargées. Réessaie.</p>
        <Button variant="secondary" onClick={load}>
          Réessayer
        </Button>
      </main>
    );
  }

  if (owned === null && ownedFailed) {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={() => ownedCards.ensure()} />
      </main>
    );
  }

  if (view === null) return <AlbumWaiting cardWidth={cardWidth} />;

  const practiceCards =
    progress !== null && isFeatureOpen("practice_choice", progress.level, now)
      ? albumPracticeCards(view, state, practiceRulesAt(PRACTICE_SCHEDULE, now).minWords)
      : null;

  const pickCollection = (id: string) => {
    writeCollection(id);
    setState((s) => ({ ...s, collectionId: id, rarity: null, theme: null, search: "" }));
  };

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

      <div className={styles.desk}>
        <Desk className={styles.deskBack} />
        {/* The collections and filters scroll away with the cards, so that the cards get the desk. */}
        <div className={styles.shelf}>
          <div ref={setScroller} className={styles.scroller}>
            <div
              className={`${styles.tabs} ${view.searching ? styles.dimmed : ""}`}
              role="tablist"
              aria-label="Collections"
            >
              {view.tabs.map((tab) => {
                const selected = !view.searching && tab.id === state.collectionId;
                const file = catalog?.collections.find((c) => c.id === tab.id);
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
                      {file !== undefined && (
                        <CollectionSeal collection={packOf(file)} size={narrow ? 24 : 30} />
                      )}
                      <span className={styles.tabText}>
                        <span className={styles.tabName}>
                          {narrow ? shortName(tab.name) : tab.name}
                        </span>
                        <span className={styles.tabCount}>{tab.count}</span>
                      </span>
                    </span>
                    <span className={styles.tabTrack}>
                      <span
                        className={styles.tabFill}
                        style={{
                          width: `${Math.round(tab.ratio * 100)}%`,
                          background: collectionTone(tab.id),
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {!view.searching && (
              <>
                {tagline !== undefined && <p className={styles.tagline}>{tagline}</p>}
                <div className={styles.row}>
                  {view.rarities.map((chip) => (
                    <RarityChip
                      key={chip.rarity}
                      rarity={chip.rarity}
                      count={chip.count}
                      aria={chip.aria}
                      on={state.rarity === chip.rarity}
                      onPick={() =>
                        setState((s) => ({
                          ...s,
                          rarity: s.rarity === chip.rarity ? null : chip.rarity,
                        }))
                      }
                    />
                  ))}
                  <SortPicker sort={sort} onPick={pickSort} />
                </div>
                {friend !== null && state.compare != null && (
                  <div className={styles.compare}>
                    <p className={styles.compareTitle}>{comparingTitle(friend.name)}</p>
                    <div className={styles.row}>
                      {compareFilters(friend.name).map((choice) => (
                        <FilterChip
                          key={choice.id}
                          label={choice.label}
                          on={state.compare === choice.id}
                          onPick={() =>
                            setState((s) => ({ ...s, compare: choice.id as CompareFilter }))
                          }
                        />
                      ))}
                      <Button variant="ghost" small onClick={() => router.replace("/album")}>
                        Fermer la comparaison
                      </Button>
                    </div>
                  </div>
                )}
                <div className={styles.row} hidden={friend !== null && state.compare != null}>
                  {view.filters.map((filter) => (
                    <FilterChip
                      key={filter.id}
                      label={filter.label}
                      count={filter.count}
                      on={state.filter === filter.id}
                      onPick={() => setState((s) => ({ ...s, filter: filter.id as AlbumFilter }))}
                    />
                  ))}
                  {view.themes.length > 0 && (
                    <>
                      <span className={styles.divider} aria-hidden="true" />
                      <button
                        type="button"
                        className={`${ui.chip} ${styles.filter} ${styles.theme}`}
                        aria-expanded={themesOpen}
                        aria-controls="album-themes"
                        onClick={() => setThemesOpen((open) => !open)}
                      >
                        {themesOpen ? ALBUM_THEME_TEXTS.hide : ALBUM_THEME_TEXTS.show}
                        <Icon name="chevd" size={14} />
                      </button>
                    </>
                  )}
                  {!themesOpen && pickedTheme !== undefined && (
                    <FilterChip
                      label={pickedTheme.label}
                      on
                      muted
                      onPick={() => setState((s) => ({ ...s, theme: null }))}
                    />
                  )}
                </div>
                {themesOpen && (
                  <div id="album-themes" className={`${styles.row} ${styles.themes}`}>
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
                )}
              </>
            )}
            {view.searching && (
              <div className={styles.row}>
                <SortPicker sort={sort} onPick={pickSort} />
              </div>
            )}

            {practiceCards !== null && (
              <div className={styles.revise}>
                <Button
                  variant="secondary"
                  small
                  onClick={() => {
                    askAlbumPractice(practiceCards);
                    router.push("/defis?revision=album");
                  }}
                >
                  Réviser ces mots
                </Button>
              </div>
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
                  {view.items.slice(0, shown).map((item, index) => (
                    <li key={itemKey(item)} className={styles.slot} data-index={index}>
                      <Tile item={item} width={cardWidth} onOpen={(id) => openCard(id, ownedIds)} />
                    </li>
                  ))}
                </ul>
                {shown < view.items.length && <div ref={sentinel} aria-hidden="true" />}
              </>
            )}
          </div>
          {view.empty === null && view.letters.length > 0 && (
            <nav className={styles.letters} aria-label="Aller à la lettre">
              {view.letters.map(({ letter, index }) => (
                <button
                  key={letter}
                  type="button"
                  className={styles.letter}
                  disabled={index === null}
                  onClick={() => {
                    if (index !== null) jumpTo(index);
                  }}
                >
                  {letter}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

/** Shapes for the wait: as many as the first screen shows, never as many as the real album. */
const WAITING_TABS = 4;
const WAITING_RARITIES = 6;
const WAITING_FILTERS = [72, 82, 88, 74, 110, 74, 58, 66];
const WAITING_CARDS = 12;

/** The album's frame while the catalogue and the player's cards arrive, laid out as they will be. */
function AlbumWaiting({ cardWidth }: { readonly cardWidth: number }) {
  return (
    <WaitingScreen className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={`${ui.display} ${styles.title}`}>Album</h1>
          <Bone className={styles.headlineBone} />
        </div>
        <Bone className={`${styles.search} ${styles.searchBone}`} />
      </header>
      <div className={styles.tabs}>
        {Array.from({ length: WAITING_TABS }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: shapes without identity
          <Bone key={index} className={styles.tabBone} />
        ))}
      </div>
      <div className={styles.row}>
        {Array.from({ length: WAITING_RARITIES }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: shapes without identity
          <Bone key={index} className={styles.rarityBone} />
        ))}
      </div>
      <div className={styles.row}>
        {WAITING_FILTERS.map((width, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: shapes without identity
          <Bone key={index} className={styles.filterBone} style={{ width }} />
        ))}
      </div>
      <ul
        className={styles.grid}
        style={{ "--card": `${cardWidth}px` } as CSSProperties}
        aria-hidden="true"
      >
        {Array.from({ length: WAITING_CARDS }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: shapes without identity
          <li key={index} className={`${styles.slot} ${styles.tileBone}`}>
            <Bone className={styles.cardBone} />
            <Bone className={styles.labelBone} />
          </li>
        ))}
      </ul>
    </WaitingScreen>
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
      {item.fresh && <span className={styles.fresh}>Nouveau</span>}
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
      title={aria}
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

/**
 * How the cards owned are laid out: a chip at the end of the rarities that unfolds a leaf of
 * choices. The leaf is fixed to the screen, so that a row scrolling aside never cuts it.
 */
function SortPicker({
  sort,
  onPick,
}: {
  readonly sort: AlbumSort;
  readonly onPick: (sort: AlbumSort) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ readonly top: number; readonly left: number } | null>(null);
  const close = (refocus: boolean) => {
    setAt(null);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (at === null) return;
    menu.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setAt(null);
    };
    const away = () => setAt(null);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
    };
  }, [at]);

  const open = () => {
    const box = button.current?.getBoundingClientRect();
    if (box === undefined) return;
    setAt({ top: box.bottom + 8, left: Math.max(8, box.right - SORT_MENU_WIDTH) });
  };
  const step = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
    const from = options.indexOf(document.activeElement as HTMLButtonElement);
    const by = event.key === "ArrowDown" ? 1 : -1;
    options[(from + by + options.length) % options.length]?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${ui.chip} ${styles.filter} ${styles.sort}`}
        aria-haspopup="listbox"
        aria-expanded={at !== null}
        onClick={() => (at === null ? open() : close(false))}
      >
        <span className={styles.sortTitle}>{ALBUM_SORT_TITLE}</span>
        <span className={styles.sortChoice}>{ALBUM_SORT_LABELS[sort]}</span>
        <Icon name="chevd" size={14} />
      </button>
      {at !== null && (
        <div
          ref={menu}
          role="listbox"
          aria-label={ALBUM_SORT_TITLE}
          className={`${ui.leaf} ${styles.sortMenu}`}
          style={{ top: at.top, left: at.left, width: SORT_MENU_WIDTH }}
          onKeyDown={step}
        >
          {ALBUM_SORTS.map((choice) => (
            <button
              key={choice}
              type="button"
              role="option"
              aria-selected={choice === sort}
              className={`${ui.chip} ${styles.sortOption}`}
              onClick={() => {
                onPick(choice);
                close(true);
              }}
            >
              {ALBUM_SORT_LABELS[choice]}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

const SORT_MENU_WIDTH = 200;

function FilterChip({
  label,
  count = null,
  on,
  muted = false,
  onPick,
}: {
  readonly label: string;
  /** Shown beside the label when there is something to count. */
  readonly count?: number | null;
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
      {count !== null && count > 0 && <span className={styles.filterCount}>{count}</span>}
    </button>
  );
}

"use client";

import { RARITIES, type Rarity } from "@leximon/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadCatalog } from "@/cards/catalog";
import { formatOdds } from "@/cards/display";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { Select } from "@/components/select";
import styles from "./admin.module.css";
import { type EngravingFilter, filterCards } from "./card-filter";
import { type CardSortColumn, isSortColumn, type SortDirection, sortCards } from "./card-sort";
import { formatNumber } from "./format";
import { useLoad } from "./use-load";

const PAGE = 100;
const GRID_CARD_WIDTH = 220;

type ViewMode = "table" | "grid";

const SORT_LABELS: readonly { readonly column: CardSortColumn; readonly label: string }[] = [
  { column: "word", label: "Mot" },
  { column: "rarity", label: "Rareté" },
  { column: "collection", label: "Collection" },
  { column: "engraving", label: "Gravure" },
  { column: "frequency", label: "Fréquence" },
];

function updateUrl(params: {
  collection: string | null;
  sort: CardSortColumn | null;
  dir: SortDirection;
  view: ViewMode;
}) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (params.collection) {
    url.searchParams.set("collection", params.collection);
  } else {
    url.searchParams.delete("collection");
    url.searchParams.delete("collectionId");
  }
  if (params.sort) {
    url.searchParams.set("sort", params.sort);
    url.searchParams.set("dir", params.dir);
  } else {
    url.searchParams.delete("sort");
    url.searchParams.delete("dir");
  }
  if (params.view === "grid") {
    url.searchParams.set("view", "grid");
  } else {
    url.searchParams.delete("view");
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function CardsScreen() {
  const { state } = useLoad(loadCatalog);
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(
    () => searchParams.get("collection") ?? searchParams.get("collectionId"),
  );
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [engraving, setEngraving] = useState<EngravingFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    searchParams.get("view") === "grid" ? "grid" : "table",
  );

  const [sortColumn, setSortColumn] = useState<CardSortColumn | null>(() => {
    const s = searchParams.get("sort");
    if (isSortColumn(s)) return s;
    const col = searchParams.get("collection") ?? searchParams.get("collectionId");
    return col !== null ? "collection" : null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() =>
    searchParams.get("dir") === "desc" ? "desc" : "asc",
  );

  useEffect(() => {
    const col = searchParams.get("collection") ?? searchParams.get("collectionId");
    setCollectionId(col);

    const sortParam = searchParams.get("sort");
    const dirParam = searchParams.get("dir");
    if (isSortColumn(sortParam)) {
      setSortColumn(sortParam);
      setSortDirection(dirParam === "desc" ? "desc" : "asc");
    } else if (col !== null) {
      setSortColumn("collection");
      setSortDirection("asc");
    } else {
      setSortColumn(null);
      setSortDirection("asc");
    }

    setViewMode(searchParams.get("view") === "grid" ? "grid" : "table");
    setShown(PAGE);
  }, [searchParams]);

  const catalog = state.kind === "ready" ? state.data : null;
  const all = useMemo(() => (catalog === null ? [] : [...catalog.cardsById.values()]), [catalog]);
  const names = useMemo(
    () => new Map(catalog?.collections.map((c) => [c.id, c.name] as const) ?? []),
    [catalog],
  );

  const filtered = useMemo(
    () => filterCards(all, { query, collectionId, rarity, engraving }),
    [all, query, collectionId, rarity, engraving],
  );
  const cards = useMemo(
    () =>
      sortColumn === null
        ? filtered
        : sortCards(
            filtered,
            { column: sortColumn, direction: sortDirection },
            (id) => names.get(id) ?? id,
          ),
    [filtered, sortColumn, sortDirection, names],
  );

  const engraved = useMemo(
    () => all.filter((card) => (card.engraving ?? null) !== null).length,
    [all],
  );

  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setShown(PAGE);
    };

  const onCollectionChange = (val: string | null) => {
    reset(setCollectionId)(val);
    updateUrl({ collection: val, sort: sortColumn, dir: sortDirection, view: viewMode });
  };

  const onViewChange = (nextView: ViewMode) => {
    setViewMode(nextView);
    updateUrl({ collection: collectionId, sort: sortColumn, dir: sortDirection, view: nextView });
  };

  const toggleSort = (col: CardSortColumn) => {
    let nextDir: SortDirection = "asc";
    if (sortColumn === col) {
      nextDir = sortDirection === "asc" ? "desc" : "asc";
      setSortDirection(nextDir);
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
    setShown(PAGE);
    updateUrl({ collection: collectionId, sort: col, dir: nextDir, view: viewMode });
  };

  return (
    <>
      <h1 className={styles.title}>Cartes</h1>
      <p className={styles.muted}>
        Le catalogue publié, tel que les joueurs le voient
        {catalog !== null && ` (version ${catalog.version})`}. Les textes se corrigent dans
        Directus.
      </p>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>Le catalogue ne se charge pas.</p>}
      {catalog !== null && (
        <>
          <div className={styles.toolbar}>
            <input
              className={`${styles.input} ${styles.grow}`}
              type="search"
              value={query}
              onChange={(event) => reset(setQuery)(event.target.value)}
              placeholder="Mot ou identifiant"
              aria-label="Rechercher une carte"
            />
            <Select
              value={collectionId ?? ""}
              onChange={(val) => onCollectionChange(val || null)}
              ariaLabel="Collection"
              options={[
                { value: "", label: "Toutes les collections" },
                ...catalog.collections.map((collection) => ({
                  value: collection.id,
                  label: collection.name,
                })),
              ]}
            />
            <Select
              value={rarity ?? ""}
              onChange={(val) => reset(setRarity)(RARITIES.find((r) => r === val) ?? null)}
              ariaLabel="Rareté"
              options={[
                { value: "", label: "Toutes les raretés" },
                ...RARITIES.map((option) => ({
                  value: option,
                  label: <RarityName rarity={option} />,
                })),
              ]}
            />
            <Select<EngravingFilter>
              value={engraving}
              onChange={(val) => reset(setEngraving)(val)}
              ariaLabel="Gravure"
              options={[
                { value: "all", label: "Avec ou sans gravure" },
                { value: "with", label: `Avec gravure (${formatNumber(engraved)})` },
                { value: "without", label: "Sans gravure" },
              ]}
            />
            <div className={styles.viewSwitch}>
              <button
                type="button"
                className={`${styles.viewOption} ${viewMode === "table" ? styles.viewOptionActive : ""}`}
                aria-pressed={viewMode === "table"}
                onClick={() => onViewChange("table")}
              >
                <span aria-hidden="true">☰</span> Tableau
              </button>
              <button
                type="button"
                className={`${styles.viewOption} ${viewMode === "grid" ? styles.viewOptionActive : ""}`}
                aria-pressed={viewMode === "grid"}
                onClick={() => onViewChange("grid")}
              >
                <span aria-hidden="true">⊞</span> Grille
              </button>
            </div>
          </div>
          <div className={styles.metaBar}>
            <p className={styles.muted}>
              {formatNumber(cards.length)} carte(s) sur {formatNumber(all.length)}.
            </p>
            {viewMode === "grid" && (
              <div className={styles.sortBar}>
                <span className={styles.muted}>Trier :</span>
                {SORT_LABELS.map(({ column, label }) => {
                  const active = sortColumn === column;
                  return (
                    <button
                      key={column}
                      type="button"
                      className={`${styles.sortPill} ${active ? styles.sortPillActive : ""}`}
                      onClick={() => toggleSort(column)}
                    >
                      <span>{label}</span>
                      <span aria-hidden="true">
                        {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {cards.length > 0 &&
            (viewMode === "table" ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortHeader
                        column="word"
                        label="Mot"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        column="rarity"
                        label="Rareté"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        column="collection"
                        label="Collection"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        column="engraving"
                        label="Gravure"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        column="frequency"
                        label="Fréquence"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        isNum
                        onSort={toggleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {cards.slice(0, shown).map((card) => (
                      <tr key={card.id}>
                        <td>
                          <Link href={`/admin/cartes/${encodeURIComponent(card.id)}`}>
                            {card.word}
                          </Link>{" "}
                          <span className={styles.muted}>{card.partOfSpeech}</span>
                        </td>
                        <td>
                          <RarityName rarity={card.rarity} />
                        </td>
                        <td>{names.get(card.collectionId) ?? card.collectionId}</td>
                        <td>{(card.engraving ?? null) === null ? "–" : "Oui"}</td>
                        <td className={styles.num}>{formatOdds(card.perBillion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className={styles.cardGrid}>
                {cards.slice(0, shown).map((card) => (
                  <li key={card.id}>
                    <Link
                      href={`/admin/cartes/${encodeURIComponent(card.id)}`}
                      className={styles.cardGridItem}
                    >
                      <Card
                        card={card}
                        collectionName={names.get(card.collectionId) ?? card.collectionId}
                        width={GRID_CARD_WIDTH}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          {cards.length > shown && (
            <button
              type="button"
              className={styles.button}
              onClick={() => setShown((current) => current + PAGE)}
            >
              Afficher plus
            </button>
          )}
        </>
      )}
    </>
  );
}

function SortHeader({
  column,
  label,
  activeColumn,
  direction,
  isNum = false,
  onSort,
}: {
  readonly column: CardSortColumn;
  readonly label: string;
  readonly activeColumn: CardSortColumn | null;
  readonly direction: SortDirection;
  readonly isNum?: boolean;
  readonly onSort: (column: CardSortColumn) => void;
}) {
  const active = activeColumn === column;
  return (
    <th
      className={`${styles.thSort} ${isNum ? styles.num : ""}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`${styles.sortButton} ${active ? styles.sortButtonActive : ""} ${isNum ? styles.sortNum : ""}`}
        onClick={() => onSort(column)}
        title={
          active
            ? direction === "asc"
              ? `Trier par ${label.toLowerCase()} (décroissant)`
              : `Trier par ${label.toLowerCase()} (croissant)`
            : `Trier par ${label.toLowerCase()}`
        }
      >
        <span>{label}</span>
        <span className={active ? styles.sortIcon : styles.sortIconMuted} aria-hidden="true">
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

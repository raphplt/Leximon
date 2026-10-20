"use client";

import {
  type CatalogCard,
  MASTERY_LEVEL_LABELS,
  type MasteryLevelCode,
  RARITY_LABELS,
} from "@leximon/contract";
import { rarityRank } from "@leximon/core";
import { cssFill, rarityStyles } from "@leximon/tokens";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Catalog, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { CardCaption } from "@/components/card-caption";
import { RarityName } from "@/components/rarity-icon";
import { fetchMastery, fetchOwnedCards } from "@/lib/api";
import styles from "./album-screen.module.css";

const TILE_WIDTH = 150;

/**
 * Most common first, then alphabetical: the cards a player finds early lead the album, and the
 * rarest still missing sit at the end as goals.
 */
function albumOrder(cards: readonly CatalogCard[]): CatalogCard[] {
  return [...cards].sort(
    (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.word.localeCompare(b.word, "fr"),
  );
}

export function AlbumScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [quantities, setQuantities] = useState<ReadonlyMap<string, number> | null>(null);
  const [levels, setLevels] = useState<ReadonlyMap<string, MasteryLevelCode>>(new Map());
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState<CatalogCard | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [loadedCatalog, owned, mastery] = await Promise.all([
        loadCatalog(),
        fetchOwnedCards(),
        fetchMastery(),
      ]);
      setCatalog(loadedCatalog);
      setLevels(new Map(mastery.map((word) => [word.cardId, word.level])));
      const byCard = new Map<string, number>();
      for (const card of owned) {
        byCard.set(card.cardId, (byCard.get(card.cardId) ?? 0) + card.quantity);
      }
      setQuantities(byCard);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (zoomed !== null) dialog.current?.showModal();
  }, [zoomed]);

  if (failed) {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Impossible de charger ton album.</p>
        <button type="button" className={styles.button} onClick={() => void load()}>
          Réessayer
        </button>
      </main>
    );
  }

  if (quantities === null || catalog === null) {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Un instant…</p>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      {catalog.collections.map((collection) => {
        const cards = albumOrder(collection.cards);
        const found = cards.filter((card) => quantities.has(card.id)).length;
        return (
          <section key={collection.id} aria-labelledby={`collection-${collection.id}`}>
            <header className={styles.header}>
              <h1 id={`collection-${collection.id}`} className={styles.title}>
                {collection.name}
              </h1>
              <p className={styles.count}>
                <strong>{found}</strong> / {cards.length} mots
              </p>
            </header>
            <div
              className={styles.progress}
              role="progressbar"
              aria-label="Mots trouvés"
              aria-valuemin={0}
              aria-valuemax={cards.length}
              aria-valuenow={found}
            >
              <span style={{ width: `${(found / Math.max(cards.length, 1)) * 100}%` }} />
            </div>
            {found === 0 && (
              <p className={styles.hint}>
                Ton album est vide. <Link href="/">Ouvre ton premier pli</Link> pour trouver tes
                premiers mots.
              </p>
            )}
            <ul className={styles.grid}>
              {cards.map((card) => {
                const quantity = quantities.get(card.id);
                const level = levels.get(card.id) ?? "sketch";
                return (
                  <li key={card.id} className={styles.slot}>
                    {quantity === undefined ? (
                      <MissingCard card={card} />
                    ) : (
                      <button
                        type="button"
                        className={styles.owned}
                        onClick={() => setZoomed(card)}
                        aria-label={`Agrandir ${card.word}`}
                      >
                        <Card card={card} collectionName={collection.name} width={TILE_WIDTH} />
                        {quantity > 1 && <span className={styles.quantity}>×{quantity}</span>}
                        {level !== "sketch" && (
                          <span className={`${styles.level} ${styles[level]}`}>
                            {MASTERY_LEVEL_LABELS[level]}
                          </span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes a modal dialog; the click only adds backdrop dismissal. */}
      <dialog
        ref={dialog}
        className={styles.dialog}
        onClose={() => setZoomed(null)}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        {zoomed !== null && (
          <div className={styles.zoom}>
            <Card
              card={zoomed}
              collectionName={
                catalog.collections.find((c) => c.id === zoomed.collectionId)?.name ?? ""
              }
            />
            <CardCaption card={zoomed} />
            <button type="button" className={styles.button} onClick={() => dialog.current?.close()}>
              Fermer
            </button>
          </div>
        )}
      </dialog>
    </main>
  );
}

/** Slot of a card not found yet: only its rarity shows, the word stays a surprise. */
function MissingCard({ card }: { readonly card: CatalogCard }) {
  const style = rarityStyles[card.rarity];
  return (
    <div
      className={styles.missing}
      style={{
        borderColor: typeof style.frame === "string" ? style.frame : undefined,
        backgroundImage: typeof style.frame === "string" ? undefined : cssFill(style.frame),
      }}
      aria-label={`Carte ${RARITY_LABELS[card.rarity]} pas encore trouvée`}
      role="img"
    >
      <span className={styles.missingInner}>
        <span className={styles.question} aria-hidden="true">
          ?
        </span>
        <span className={styles.missingLabel}>
          <RarityName rarity={card.rarity} />
        </span>
      </span>
    </div>
  );
}

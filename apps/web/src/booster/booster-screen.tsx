"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import { REFILL_SCHEDULE } from "@leximon/core";
import { motion, rarityStyles } from "@leximon/tokens";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type Catalog, cardOrPlaceholder, collectionName, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { fetchOwnedCards, fetchWallet, openBooster } from "@/lib/api";
import styles from "./booster-screen.module.css";
import { type DrawnCard, nextRefillLabel, recapLine, revealOrder } from "./reveal";

const STOCK_CAPACITY = REFILL_SCHEDULE[0].capacity;
const FAN_ANGLES = [-10, -5, 0, 5, 10];

type Phase =
  | { readonly name: "loading" }
  | { readonly name: "unavailable" }
  | { readonly name: "no_collection" }
  | { readonly name: "sealed" }
  | { readonly name: "opening" }
  | { readonly name: "revealing"; readonly index: number }
  | { readonly name: "recap" };

interface Pack {
  readonly cards: readonly DrawnCard[];
  readonly ownedBefore: ReadonlySet<string>;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BoosterScreen() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [wallet, setWallet] = useState<BoosterWalletResponse | null>(null);
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept until the server answers, so that a retry never opens a second booster.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const now = useNow(15_000);

  const load = useCallback(async () => {
    try {
      const [loadedCatalog, loadedWallet, ownedCards] = await Promise.all([
        loadCatalog(),
        fetchWallet(),
        fetchOwnedCards(),
      ]);
      setCatalog(loadedCatalog);
      setWallet(loadedWallet);
      setOwned(new Set(ownedCards.map((card) => card.cardId)));
      const ready: Phase =
        loadedCatalog.collections.length > 0 ? { name: "sealed" } : { name: "no_collection" };
      setPhase((current) =>
        current.name === "loading" || current.name === "unavailable" ? ready : current,
      );
    } catch {
      setPhase({ name: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The stock refills on the server's schedule: ask again once the announced time has passed.
  const refillDue = wallet?.nextRefillAt != null && Date.parse(wallet.nextRefillAt) <= now;
  useEffect(() => {
    if (!refillDue) return;
    fetchWallet()
      .then(setWallet)
      .catch(() => undefined);
  }, [refillDue]);

  // The first published collection, until the player can choose (P14).
  const collection = catalog?.collections[0];

  const open = async () => {
    if (collection === undefined) return;
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setError(null);
    setPhase({ name: "opening" });
    try {
      const animation = delay(prefersReducedMotion() ? 0 : motion.envelopeOpen);
      const [result] = await Promise.all([
        openBooster({ kind: "collection", collectionId: collection.id }, key),
        animation,
      ]);
      setPendingKey(null);
      if (result.kind === "stock_empty") {
        setWallet({ stored: 0, nextRefillAt: result.nextRefillAt });
        setPhase({ name: "sealed" });
        return;
      }
      setWallet(result.wallet);
      setPack({ cards: revealOrder(result.cards), ownedBefore: owned });
      setOwned(new Set([...owned, ...result.cards.map((card) => card.cardId)]));
      setPhase({ name: "revealing", index: 0 });
    } catch {
      setError("Le pli n'a pas pu s'ouvrir. Vérifie ta connexion et réessaie.");
      setPhase({ name: "sealed" });
    }
  };

  const next = () => {
    if (phase.name !== "revealing" || pack === null) return;
    setPhase(
      phase.index + 1 < pack.cards.length
        ? { name: "revealing", index: phase.index + 1 }
        : { name: "recap" },
    );
  };

  const stored = wallet?.stored ?? 0;
  const refill = nextRefillLabel(wallet?.nextRefillAt ?? null, now);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Pli de collection</p>
          <h1 className={styles.title}>{collection?.name ?? "Leximon"}</h1>
        </div>
        {wallet !== null && (
          <div className={styles.stock}>
            <span
              className={styles.dots}
              role="img"
              aria-label={`${stored} pli${stored > 1 ? "s" : ""} sur ${STOCK_CAPACITY}`}
            >
              {Array.from({ length: STOCK_CAPACITY }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size row of identical dots
                <span key={index} className={index < stored ? styles.dotOn : styles.dot} />
              ))}
            </span>
            {refill !== null && <span className={styles.refill}>{refill}</span>}
          </div>
        )}
      </header>

      {phase.name === "loading" && <p className={styles.hint}>Un instant…</p>}

      {phase.name === "unavailable" && (
        <div className={styles.center}>
          <p className={styles.hint}>Impossible de joindre le serveur.</p>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      )}

      {phase.name === "no_collection" && (
        <p className={styles.hint}>Aucune collection n'est encore publiée.</p>
      )}

      {phase.name === "sealed" && (
        <div className={styles.center}>
          <Envelope opening={false} disabled={stored === 0} onOpen={() => void open()} />
          {error !== null ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : (
            <p className={styles.hint}>
              {stored > 0
                ? "Touche le sceau pour ouvrir"
                : `Plus de pli pour l'instant, ${refill ?? ""}`}
            </p>
          )}
        </div>
      )}

      {phase.name === "opening" && (
        <div className={styles.center}>
          <Envelope opening disabled onOpen={() => undefined} />
          <p className={styles.hint} aria-live="polite">
            Ouverture…
          </p>
        </div>
      )}

      {phase.name === "revealing" && pack !== null && catalog !== null && (
        <Reveal
          catalog={catalog}
          key={phase.index}
          card={pack.cards[phase.index]}
          isNew={!pack.ownedBefore.has(pack.cards[phase.index]?.cardId ?? "")}
          position={phase.index + 1}
          total={pack.cards.length}
          onNext={next}
        />
      )}

      {phase.name === "recap" && pack !== null && (
        <div className={styles.recap}>
          <h2 className={styles.recapTitle}>Ton pli</h2>
          <p className={styles.recapLine}>{recapLine(pack.cards, pack.ownedBefore)}</p>
          <ul className={styles.fan}>
            {pack.cards.map((drawn, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: a pack can hold the same card twice
                key={index}
                className={styles.fanCard}
                style={{
                  transform: `translateX(${(index - (pack.cards.length - 1) / 2) * 34}px) rotate(${FAN_ANGLES[index] ?? 0}deg)`,
                }}
              >
                <CatalogCardView catalog={catalog} drawn={drawn} width={140} />
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={stored === 0}
              onClick={() => void open()}
            >
              {stored > 0 ? "Ouvrir un autre pli" : `Plus de pli, ${refill ?? ""}`}
            </button>
            <Link href="/album" className={styles.secondary}>
              Voir mon album
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Envelope({
  opening,
  disabled,
  onOpen,
}: {
  readonly opening: boolean;
  readonly disabled: boolean;
  readonly onOpen: () => void;
}) {
  return (
    <div className={opening ? `${styles.envelope} ${styles.opening}` : styles.envelope}>
      <div className={styles.burst} aria-hidden="true">
        <span className={styles.burstCardA} />
        <span className={styles.burstCardB} />
      </div>
      <div className={styles.kraft} />
      <div className={styles.strip} aria-hidden="true">
        ✂ déchirer ici
      </div>
      <span className={styles.sticker}>5 mots à découvrir</span>
      <span className={styles.brand}>Leximon</span>
      <button
        type="button"
        className={styles.seal}
        aria-label="Briser le sceau et ouvrir le pli"
        disabled={disabled}
        onClick={onOpen}
      >
        <span aria-hidden="true">L</span>
      </button>
    </div>
  );
}

/** A drawn card as the catalogue describes it. */
function CatalogCardView({
  catalog,
  drawn,
  width,
}: {
  readonly catalog: Catalog | null;
  readonly drawn: DrawnCard;
  readonly width?: number;
}) {
  if (catalog === null) return null;
  const card = cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity);
  const name = collectionName(catalog, card.collectionId);
  return width === undefined ? (
    <Card card={card} collectionName={name} />
  ) : (
    <Card card={card} collectionName={name} width={width} />
  );
}

function Reveal({
  catalog,
  card: drawn,
  isNew,
  position,
  total,
  onNext,
}: {
  readonly catalog: Catalog;
  readonly card: DrawnCard | undefined;
  readonly isNew: boolean;
  readonly position: number;
  readonly total: number;
  readonly onNext: () => void;
}) {
  if (drawn === undefined) return null;
  const card = cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity);
  const glow = rarityStyles[card.rarity].glow;
  const last = position === total;
  return (
    <div className={styles.reveal}>
      <div className={styles.revealStage}>
        {glow !== null && (
          <div
            className={styles.glow}
            style={{ background: `radial-gradient(ellipse, ${glow} 0%, transparent 65%)` }}
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          className={styles.revealCard}
          onClick={onNext}
          aria-label="Carte suivante"
        >
          <Card card={card} collectionName={collectionName(catalog, card.collectionId)} />
        </button>
        {isNew && <span className={styles.newBadge}>Nouveau !</span>}
      </div>
      <div className={styles.revealBar}>
        <span className={styles.position}>
          {position} / {total}
        </span>
        <button type="button" className={styles.next} onClick={onNext}>
          {last ? "Voir mon pli" : "Suivante"}
        </button>
      </div>
    </div>
  );
}

/** Current time, refreshed every `intervalMs`. 0 until mounted: the clock is read in the browser only. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

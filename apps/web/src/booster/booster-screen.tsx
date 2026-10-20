"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import { type Rarity, REFILL_SCHEDULE } from "@leximon/core";
import { motion } from "@leximon/tokens";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Catalog, cardOrPlaceholder, collectionName, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { fetchOwnedCards, fetchWallet, type OpenBoosterResult, openBooster } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import styles from "./booster-screen.module.css";
import { CardStack } from "./card-stack";
import { canVibrate, type FeedbackKind, play, readPreference, writePreference } from "./feedback";
import { OPEN_HINTS, type PackProps, type PackShape, packShapeFromSearch } from "./pack-shape";
import { Pli } from "./pli";
import {
  bonusLabel,
  collectionProgress,
  copiesAt,
  type DrawnCard,
  firstOfRarityLabel,
  isFirstOfRarity,
  nextRefillLabel,
  recap,
  revealOrder,
} from "./reveal";
import { RevealCard } from "./reveal-card";
import { Sachet } from "./sachet";
import { keepsAnnouncementWhenHurried, stagingFor } from "./staging";

const STOCK_CAPACITY = REFILL_SCHEDULE[0].capacity;
const FAN_ANGLES = [-10, -5, 0, 5, 10];
/** Room left around a revealed card on a narrow phone, in px. */
const CARD_MARGIN = 56;
const CARD_MAX_WIDTH = 300;

type Phase =
  | { readonly name: "loading" }
  | { readonly name: "unavailable" }
  | { readonly name: "no_collection" }
  | { readonly name: "sealed" }
  | { readonly name: "opening" }
  | { readonly name: "stack" }
  | { readonly name: "revealing"; readonly index: number; readonly hurried: boolean }
  | { readonly name: "recap" };

interface Pack {
  /** In reveal order: the rarest card comes last. */
  readonly cards: readonly DrawnCard[];
  readonly quantitiesBefore: ReadonlyMap<string, number>;
  readonly raritiesBefore: ReadonlySet<Rarity>;
  readonly collectionName: string;
  readonly collectionCardIds: ReadonlySet<string>;
}

type Outcome =
  | { readonly kind: "answered"; readonly result: OpenBoosterResult }
  | { readonly kind: "failed" };

/** The request of the pack being opened, kept from the start of the tear to the server's answer. */
interface OpenRequest {
  /** Kept until the server answers, so that a retry never opens a second booster. */
  readonly key: string;
  readonly outcome: Promise<Outcome> | null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function quantities(owned: readonly { cardId: string; quantity: number }[]): Map<string, number> {
  const byId = new Map<string, number>();
  for (const { cardId, quantity } of owned) byId.set(cardId, (byId.get(cardId) ?? 0) + quantity);
  return byId;
}

export function BoosterScreen() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [wallet, setWallet] = useState<BoosterWalletResponse | null>(null);
  const [owned, setOwned] = useState<ReadonlyMap<string, number>>(new Map());
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<OpenRequest | null>(null);
  const [shape, setShape] = useState<PackShape>("pli");
  const now = useNow(15_000);
  const cardWidth = useCardWidth();

  const load = useCallback(async () => {
    try {
      const [loadedCatalog, loadedWallet, ownedCards] = await Promise.all([
        loadCatalog(),
        fetchWallet(),
        fetchOwnedCards(),
      ]);
      setCatalog(loadedCatalog);
      setWallet(loadedWallet);
      setOwned(quantities(ownedCards));
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

  useEffect(() => {
    setShape(packShapeFromSearch(window.location.search));
  }, []);

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

  /** Sends the request as soon as the tear begins: the server answers while the player tears. */
  const startRequest = (): OpenRequest | null => {
    if (collection === undefined) return null;
    const current = request.current ?? { key: crypto.randomUUID(), outcome: null };
    if (current.outcome !== null) return current;
    const started: OpenRequest = {
      key: current.key,
      outcome: openBooster({ kind: "collection", collectionId: collection.id }, current.key).then(
        (result): Outcome => ({ kind: "answered", result }),
        (): Outcome => ({ kind: "failed" }),
      ),
    };
    request.current = started;
    return started;
  };

  const openPack = async () => {
    const started = startRequest();
    if (started?.outcome == null || catalog === null || collection === undefined) return;
    setError(null);
    setPhase({ name: "opening" });
    const reduced = prefersReducedMotion();
    const [outcome] = await Promise.all([started.outcome, delay(reduced ? 0 : motion.sealBreak)]);
    if (outcome.kind === "failed") {
      // Same key next time: if the server did open the booster, it answers with the same cards.
      request.current = { key: started.key, outcome: null };
      setError("Le pli n'a pas pu s'ouvrir. Vérifie ta connexion et réessaie.");
      setPhase({ name: "sealed" });
      return;
    }
    request.current = null;
    const { result } = outcome;
    if (result.kind === "stock_empty") {
      setWallet({ stored: 0, nextRefillAt: result.nextRefillAt, bonus: 0 });
      setPhase({ name: "sealed" });
      return;
    }
    const raritiesBefore = new Set<Rarity>();
    for (const id of owned.keys()) {
      const rarity = catalog.cardsById.get(id)?.rarity;
      if (rarity !== undefined) raritiesBefore.add(rarity);
    }
    setWallet(result.wallet);
    setPack({
      cards: revealOrder(result.cards),
      quantitiesBefore: owned,
      raritiesBefore,
      collectionName: collection.name,
      collectionCardIds: new Set(collection.cards.map((card) => card.id)),
    });
    const after = new Map(owned);
    for (const card of result.cards) after.set(card.cardId, (after.get(card.cardId) ?? 0) + 1);
    setOwned(after);
    if (reduced) {
      setPhase({ name: "revealing", index: 0, hurried: false });
    } else {
      play("cardSlide");
      setPhase({ name: "stack" });
    }
  };

  const toRecap = () => {
    play("recap");
    setPhase({ name: "recap" });
  };

  /** Next card, or, once the player asked to reveal everything, the next Épique or Légendaire. */
  const next = () => {
    if (phase.name !== "revealing" || pack === null) return;
    const from = phase.index + 1;
    const index = phase.hurried
      ? pack.cards.findIndex((card, i) => i >= from && keepsAnnouncementWhenHurried(card.rarity))
      : from < pack.cards.length
        ? from
        : -1;
    if (index === -1) toRecap();
    else setPhase({ name: "revealing", index, hurried: phase.hurried });
  };

  const revealAll = () => {
    if (pack === null) return;
    const from = phase.name === "revealing" ? phase.index + 1 : 0;
    const index = pack.cards.findIndex(
      (card, i) => i >= from && keepsAnnouncementWhenHurried(card.rarity),
    );
    if (index === -1) toRecap();
    else setPhase({ name: "revealing", index, hurried: true });
  };

  const stored = wallet?.stored ?? 0;
  const bonus = wallet?.bonus ?? 0;
  // Bonus boosters are opened once the free stock is empty (the server decides which is spent).
  const canOpen = stored > 0 || bonus > 0;
  const refill = nextRefillLabel(wallet?.nextRefillAt ?? null, now);
  const reserve = bonusLabel(bonus);
  const sealedHint =
    stored > 0
      ? OPEN_HINTS[shape]
      : bonus > 0
        ? `${OPEN_HINTS[shape]} : c'est un pli bonus`
        : `Plus de pli pour l'instant, ${refill ?? ""}`;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Pli de collection</p>
          <h1 className={styles.title}>{collection?.name ?? "Leximon"}</h1>
        </div>
        <div className={styles.side}>
          <FeedbackToggles />
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
              {reserve !== null && <span className={styles.bonus}>{reserve}</span>}
            </div>
          )}
        </div>
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

      {(phase.name === "sealed" || phase.name === "opening") && (
        <div className={styles.center}>
          <Pack
            shape={shape}
            state={phase.name === "opening" ? "opening" : canOpen ? "sealed" : "empty"}
            onTearStart={() => {
              startRequest();
            }}
            onOpen={() => void openPack()}
          />
          {phase.name === "opening" ? (
            <p className={styles.hint} aria-live="polite">
              Ouverture…
            </p>
          ) : error !== null ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : (
            <p className={styles.hint}>{sealedHint}</p>
          )}
        </div>
      )}

      {phase.name === "stack" && pack !== null && (
        <div className={styles.center}>
          <CardStack
            cards={pack.cards}
            width={cardWidth}
            onReveal={() => {
              play("cardSlide");
              setPhase({ name: "revealing", index: 0, hurried: false });
            }}
          />
          <div className={styles.revealBar}>
            <p className={styles.hint}>Touche la pile pour révéler tes mots</p>
            <button type="button" className={styles.skip} onClick={revealAll}>
              Tout révéler
            </button>
          </div>
        </div>
      )}

      {phase.name === "revealing" && pack !== null && catalog !== null && (
        <Revealing
          catalog={catalog}
          pack={pack}
          index={phase.index}
          hurried={phase.hurried}
          width={cardWidth}
          onNext={next}
          onRevealAll={revealAll}
        />
      )}

      {phase.name === "recap" && pack !== null && (
        <Recap
          catalog={catalog}
          pack={pack}
          stored={stored}
          bonus={bonus}
          refill={refill}
          onOpen={() => {
            setPack(null);
            setPhase({ name: "sealed" });
          }}
        />
      )}
    </main>
  );
}

function Pack({ shape, ...props }: PackProps & { readonly shape: PackShape }) {
  return shape === "sachet" ? <Sachet {...props} /> : <Pli {...props} />;
}

function Revealing({
  catalog,
  pack,
  index,
  hurried,
  width,
  onNext,
  onRevealAll,
}: {
  readonly catalog: Catalog;
  readonly pack: Pack;
  readonly index: number;
  readonly hurried: boolean;
  readonly width: number;
  readonly onNext: () => void;
  readonly onRevealAll: () => void;
}) {
  const drawn = pack.cards[index];
  if (drawn === undefined) return null;
  const card = cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity);
  const isNew =
    !pack.quantitiesBefore.has(drawn.cardId) &&
    pack.cards.findIndex((c) => c.cardId === drawn.cardId) === index;
  const progress = collectionProgress(
    pack.collectionCardIds,
    pack.quantitiesBefore,
    pack.cards,
    index,
  );
  const last = index === pack.cards.length - 1;
  return (
    <div className={styles.revealing}>
      <RevealCard
        key={index}
        card={card}
        collectionName={collectionName(catalog, card.collectionId)}
        staging={stagingFor(drawn.rarity, { reducedMotion: prefersReducedMotion(), hurried })}
        width={width}
        isNew={isNew}
        copies={copiesAt(pack.cards, index, pack.quantitiesBefore)}
        firstLabel={
          isFirstOfRarity(pack.cards, index, pack.raritiesBefore)
            ? firstOfRarityLabel(drawn.rarity)
            : null
        }
        onNext={onNext}
      />
      <div className={styles.revealBar}>
        <span className={styles.revealRarity}>
          <RarityName rarity={drawn.rarity} />
        </span>
        <span className={styles.position}>
          {index + 1} / {pack.cards.length}
          <span className={styles.progress}>
            {" "}
            · {pack.collectionName} {progress.owned}/{progress.total}
          </span>
        </span>
        <div className={styles.revealActions}>
          {!last && !hurried && (
            <button type="button" className={styles.skip} onClick={onRevealAll}>
              Tout révéler
            </button>
          )}
          <button type="button" className={styles.next} onClick={onNext}>
            {last ? "Voir mon pli" : "Suivante"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Recap({
  catalog,
  pack,
  stored,
  bonus,
  refill,
  onOpen,
}: {
  readonly catalog: Catalog | null;
  readonly pack: Pack;
  readonly stored: number;
  readonly bonus: number;
  readonly refill: string | null;
  readonly onOpen: () => void;
}) {
  const progress = collectionProgress(pack.collectionCardIds, pack.quantitiesBefore, pack.cards);
  return (
    <div className={styles.recap}>
      <h2 className={styles.recapTitle}>Ton pli</h2>
      <RecapLine pack={pack} />
      <p className={styles.recapProgress}>
        {pack.collectionName} · {progress.owned}/{progress.total}
        {progress.gained > 0 && <span className={styles.gained}> (+{progress.gained})</span>}
      </p>
      <ul className={styles.fan}>
        {pack.cards.map((drawn, index) => {
          const isNew =
            !pack.quantitiesBefore.has(drawn.cardId) &&
            pack.cards.findIndex((c) => c.cardId === drawn.cardId) === index;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: a pack can hold the same card twice
              key={index}
              className={styles.fanCard}
              style={{
                transform: `translateX(${(index - (pack.cards.length - 1) / 2) * 34}px) rotate(${FAN_ANGLES[index] ?? 0}deg)`,
              }}
            >
              {catalog !== null && (
                <Card
                  card={cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity)}
                  collectionName={pack.collectionName}
                  width={140}
                />
              )}
              {isNew && <span className={styles.fanNew}>Nouveau</span>}
            </li>
          );
        })}
      </ul>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={stored === 0 && bonus === 0}
          onClick={onOpen}
        >
          {stored > 0
            ? "Ouvrir un autre pli"
            : bonus > 0
              ? "Ouvrir un pli bonus"
              : `Plus de pli, ${refill ?? ""}`}
        </button>
        <Link href="/album" className={styles.secondary}>
          Voir mon album
        </Link>
      </div>
    </div>
  );
}

function RecapLine({ pack }: { readonly pack: Pack }) {
  const { best, fresh } = recap(pack.cards, pack.quantitiesBefore);
  return (
    <p className={styles.recapLine}>
      {best !== null && (
        <>
          <RarityName rarity={best.rarity} text={best.label} />
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>{fresh}</span>
    </p>
  );
}

/** Sound and vibration switches. Vibration is offered only where the browser supports it. */
function FeedbackToggles() {
  const [state, setState] = useState<Record<FeedbackKind, boolean> | null>(null);
  const [vibrates, setVibrates] = useState(false);

  useEffect(() => {
    setState({ sound: readPreference("sound"), haptics: readPreference("haptics") });
    setVibrates(canVibrate());
  }, []);

  if (state === null) return null;
  const toggle = (kind: FeedbackKind) => {
    const enabled = !state[kind];
    writePreference(kind, enabled);
    setState({ ...state, [kind]: enabled });
  };
  return (
    <div className={styles.toggles}>
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={state.sound}
        aria-label="Son"
        onClick={() => toggle("sound")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {state.sound ? (
            <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" />
          ) : (
            <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" />
          )}
        </svg>
      </button>
      {vibrates && (
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={state.haptics}
          aria-label="Vibration"
          onClick={() => toggle("haptics")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="4" width="8" height="16" rx="2" />
            {state.haptics ? (
              <path d="M4.5 9v6M19.5 9v6M2 10.5v3M22 10.5v3" fill="none" />
            ) : (
              <path d="M3 3l18 18" fill="none" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}

/** Width of a revealed card: the reference 300 px, narrower on a small phone. */
function useCardWidth(): number {
  const [width, setWidth] = useState(CARD_MAX_WIDTH);
  useEffect(() => {
    const measure = () => setWidth(Math.min(CARD_MAX_WIDTH, window.innerWidth - CARD_MARGIN));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return width;
}

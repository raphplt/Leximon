"use client";

import type { ProgressGain } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { motion } from "@leximon/tokens";
import {
  type CollectionChoice,
  collectionChoices,
  levelRatio,
  levelUpLabel,
  lockedToast,
  neighbourChoices,
  openAgainLabel,
  pickCollection,
  stockView,
  xpGainLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Catalog, cardOrPlaceholder, collectionName, loadCatalog } from "@/cards/catalog";
import { prepareSpokenWords } from "@/cards/use-spoken-word";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { fetchChallenges, type OpenBoosterResult, openBooster } from "@/lib/api";
import type { PackShape } from "@/lib/pack-shape";
import { usePackShape } from "@/lib/use-pack-shape";
import { CollectionPicker } from "@/play/collection-picker";
import { noteSachetOpened, StockRing, TearHint } from "@/play/counter-bits";
import { LevelStrip } from "@/play/level-strip";
import { PackPeek } from "@/play/pack-peek";
import play from "@/play/play.module.css";
import { PlayFabs } from "@/play/play-fabs";
import { SlippingWord } from "@/play/slipping-word";
import { OWNED_CARDS_MAX_AGE_MS, ownedCards } from "@/player/collection";
import { account, wallet } from "@/player/player";
import { useShared } from "@/player/resource";
import { publishProgress, useProgress } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Button, ButtonLink } from "@/ui/button";
import { XpBar } from "@/ui/level-bits";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./booster-screen.module.css";
import { CardStack } from "./card-stack";
import { play as playSound } from "./feedback";
import { type PackCollection, packOf } from "./pack-looks";
import { OPEN_HINTS, type PackProps } from "./pack-shape";
import { Pli } from "./pli";
import {
  collectionProgress,
  copiesAt,
  type DrawnCard,
  firstOfRarityLabel,
  isFirstOfRarity,
  recap,
  revealOrder,
} from "./reveal";
import { RevealCard } from "./reveal-card";
import { Sachet } from "./sachet";
import { keepsAnnouncementWhenHurried, stagingFor } from "./staging";

const FAN_ANGLES = [-10, -5, 0, 5, 10];
/** Room left around a revealed card on a narrow phone, in px. */
const CARD_MARGIN = 56;
const CARD_MAX_WIDTH = 300;
/** The sachet chosen last, kept on the device. */
const CHOICE_KEY = "leximon.sachet";

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
  /** Tone of the card backs (`back` of the collection). */
  readonly back: string | undefined;
  /** Cards the progress line counts: the collection's. */
  readonly collectionCardIds: ReadonlySet<string>;
  /** XP this pack earned. */
  readonly progress: ProgressGain;
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

function readChoice(): string | null {
  try {
    return window.localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

function writeChoice(id: string): void {
  try {
    window.localStorage.setItem(CHOICE_KEY, id);
  } catch {
    // Not remembered for the next visit; the choice still applies to this one.
  }
}

/** The Jouer screen and the opening of a sachet. */
export function BoosterScreen() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [owned, setOwned] = useState<ReadonlyMap<string, number>>(new Map());
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wanted, setWanted] = useState<string | null>(null);
  /** The word most at risk of being forgotten, shown under the counter; null when none is due. */
  const [slipping, setSlipping] = useState<string | null>(null);
  const request = useRef<OpenRequest | null>(null);
  const { shape, known } = usePackShape();
  const view = usePlayerView();
  const who = useShared(account);
  const toast = useToast();
  const cardWidth = useCardWidth();
  const { now } = view;
  const currentWallet = view.wallet;
  /** Boosters a guest may still open before creating an account; null for a member. */
  const guestLeft = who?.kind === "guest" ? who.boostersLeft : null;

  // Everything that sizes the counter is awaited together, so that it appears whole: nothing
  // arriving a moment later (the stock, the word slipping away) pushes the sachet around.
  const load = useCallback(async () => {
    try {
      const [loadedCatalog, copies, slippingId] = await Promise.all([
        loadCatalog(),
        ownedCards.read(OWNED_CARDS_MAX_AGE_MS),
        fetchChallenges(1).then(
          (challenges) => challenges.questions[0]?.cardId ?? null,
          // Only a reminder: the counter goes without it rather than wait for it.
          () => null,
        ),
        wallet.read(),
        account.read().catch(() => null),
      ]);
      setCatalog(loadedCatalog);
      setOwned(copies);
      setSlipping(slippingId);
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
    setWanted(readChoice());
    void load();
  }, [load]);

  // The stock refills on the server's schedule: ask again once the announced time has passed.
  const refillDue =
    currentWallet?.nextRefillAt != null && now > 0 && Date.parse(currentWallet.nextRefillAt) <= now;
  useEffect(() => {
    if (refillDue) wallet.refresh();
  }, [refillDue]);

  const level = view.progress?.level ?? 1;
  const choices =
    catalog === null || now === 0 ? [] : collectionChoices(catalog.collections, level, now);
  const choice = choices.length === 0 ? null : pickCollection(choices, wanted);

  /** The last change of sachet: where the new one came from, and which one it replaced. */
  const [swap, setSwap] = useState<{ from: "left" | "right"; previous: string } | null>(null);

  /** `from`: the side the new sachet comes in from; without it, no swap to play. */
  const pick = (next: CollectionChoice, from: "left" | "right" | null = null) => {
    setSwap(
      choice !== null && from !== null && next.id !== choice.id
        ? { from, previous: choice.id }
        : null,
    );
    setWanted(next.id);
    writeChoice(next.id);
  };
  const entryOf = (id: string) =>
    swap === null ? null : id === swap.previous ? ("front" as const) : ("outside" as const);

  /** Sends the request as soon as the tear begins: the server answers while the player tears. */
  const startRequest = (): OpenRequest | null => {
    if (choice === null) return null;
    const current = request.current ?? { key: crypto.randomUUID(), outcome: null };
    if (current.outcome !== null) return current;
    const started: OpenRequest = {
      key: current.key,
      outcome: openBooster(choice.source, current.key).then(
        (result): Outcome => ({ kind: "answered", result }),
        (): Outcome => ({ kind: "failed" }),
      ),
    };
    request.current = started;
    return started;
  };

  const openPack = async () => {
    const started = startRequest();
    if (started?.outcome == null || catalog === null || choice === null) return;
    setError(null);
    setPhase({ name: "opening" });
    const reduced = prefersReducedMotion();
    // The words start loading while the seal still breaks.
    void started.outcome.then((answer) => {
      if (answer.kind !== "answered" || answer.result.kind !== "opened") return;
      prepareSpokenWords(
        answer.result.cards.flatMap((drawn) => catalog.cardsById.get(drawn.cardId) ?? []),
      );
    });
    const [outcome] = await Promise.all([started.outcome, delay(reduced ? 0 : motion.sealBreak)]);
    if (outcome.kind === "failed") {
      // Same key next time: if the server did open the booster, it answers with the same cards.
      request.current = { key: started.key, outcome: null };
      setError("Le sachet ne s'est pas ouvert. Vérifie ta connexion.");
      setPhase({ name: "sealed" });
      return;
    }
    request.current = null;
    const { result } = outcome;
    if (result.kind === "stock_empty") {
      wallet.refresh();
      setPhase({ name: "sealed" });
      return;
    }
    if (result.kind === "signup_required") {
      if (who?.kind === "guest") account.publish({ ...who, boostersLeft: 0 });
      setPhase({ name: "sealed" });
      return;
    }
    if (result.kind === "level_required") {
      // The screen thought the choice was open: back to the starter sachet.
      pick(choices[0] ?? choice);
      toast(lockedToast("choose_collection", now));
      setPhase({ name: "sealed" });
      return;
    }
    if (who?.kind === "guest") {
      account.publish({ ...who, boostersLeft: Math.max(0, who.boostersLeft - 1) });
    }
    const raritiesBefore = new Set<Rarity>();
    for (const id of owned.keys()) {
      const rarity = catalog.cardsById.get(id)?.rarity;
      if (rarity !== undefined) raritiesBefore.add(rarity);
    }
    noteSachetOpened();
    wallet.publish(result.wallet);
    publishProgress(result.progress);
    const collection = catalog.collections.find((c) => c.id === choice.id);
    setPack({
      cards: revealOrder(result.cards),
      quantitiesBefore: owned,
      raritiesBefore,
      collectionName: collection?.name ?? choice.name,
      back: collection?.back,
      collectionCardIds: new Set(
        collection === undefined ? catalog.cardsById.keys() : collection.cards.map((c) => c.id),
      ),
      progress: result.progress,
    });
    const after = new Map(owned);
    for (const card of result.cards) after.set(card.cardId, (after.get(card.cardId) ?? 0) + 1);
    setOwned(after);
    ownedCards.publish(after);
    if (reduced) {
      setPhase({ name: "revealing", index: 0, hurried: false });
    } else {
      playSound("cardSlide");
      setPhase({ name: "stack" });
    }
  };

  const toRecap = () => {
    playSound("recap");
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

  const stock = currentWallet === null || now === 0 ? null : stockView(currentWallet, now);
  const mustSignUp = guestLeft === 0;
  // Bonus boosters are opened once the free stock is empty (the server decides which is spent).
  const canOpen = !mustSignUp && stock !== null && !stock.empty;

  if (phase.name === "stack" || phase.name === "revealing" || phase.name === "recap") {
    return (
      <main className={styles.screen}>
        {phase.name === "stack" && pack !== null && (
          <div className={styles.center}>
            <CardStack
              cards={pack.cards}
              width={cardWidth}
              tone={pack.back}
              onReveal={() => {
                playSound("cardSlide");
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
            mustSignUp={mustSignUp}
            onOpen={() => {
              setPack(null);
              setPhase({ name: "sealed" });
            }}
          />
        )}
      </main>
    );
  }

  const ready = phase.name === "sealed" || phase.name === "opening";
  const files = new Map(catalog?.collections.map((c) => [c.id, c]) ?? []);
  const packOfChoice = (c: CollectionChoice): PackCollection => {
    const file = files.get(c.id);
    return file === undefined ? { id: c.id, name: c.name, back: undefined } : packOf(file);
  };
  const packCollection = choice === null ? null : packOfChoice(choice);
  const around =
    choice === null || phase.name === "opening"
      ? { left: null, right: null }
      : neighbourChoices(choices, choice);
  const onLocked = () => toast(lockedToast("choose_collection", now));
  // The counter is drawn once its size is known, whole: drawn empty first, it would shrink
  // under the eye when the word slipping away takes its place below.
  const waiting = phase.name === "loading" || (ready && !known);
  return (
    <main className={play.page}>
      <LevelStrip />
      {waiting ? (
        <p className={play.waiting}>On fouille les rayons…</p>
      ) : (
        <>
          <div className={`${play.floor} ${play.arrived}`}>
            <PlayFabs />
            <section className={play.counter} aria-label="Le comptoir">
              <div className={play.counterHead}>
                {choice !== null && (
                  <CollectionPicker
                    choices={choices}
                    current={choice}
                    onPick={pick}
                    onLocked={onLocked}
                  />
                )}
                {stock !== null && <StockRing stock={stock} />}
              </div>

              <div className={play.stage}>
                {phase.name === "unavailable" && (
                  <>
                    <p className={play.message}>Le serveur lambine.</p>
                    <Button variant="secondary" onClick={() => void load()}>
                      Réessayer
                    </Button>
                  </>
                )}
                {phase.name === "no_collection" && (
                  <p className={play.message}>Aucune collection n'est encore publiée.</p>
                )}
                {ready && known && packCollection !== null && (
                  <div className={play.sachet}>
                    {around.left !== null && (
                      <PackPeek
                        key={around.left.id}
                        side="left"
                        choice={around.left}
                        pack={packOfChoice(around.left)}
                        entry={entryOf(around.left.id)}
                        onPick={pick}
                        onLocked={onLocked}
                      />
                    )}
                    <div
                      key={packCollection.id}
                      className={`${play.front} ${
                        swap === null ? "" : swap.from === "right" ? play.fromRight : play.fromLeft
                      }`}
                    >
                      <PackView
                        shape={shape}
                        collection={packCollection}
                        state={phase.name === "opening" ? "opening" : canOpen ? "sealed" : "empty"}
                        refill={stock?.refill}
                        onTearStart={() => {
                          startRequest();
                        }}
                        onOpen={() => void openPack()}
                      />
                    </div>
                    {around.right !== null && (
                      <PackPeek
                        key={around.right.id}
                        side="right"
                        choice={around.right}
                        pack={packOfChoice(around.right)}
                        entry={entryOf(around.right.id)}
                        onPick={pick}
                        onLocked={onLocked}
                      />
                    )}
                  </div>
                )}
                {ready && known && canOpen && phase.name === "sealed" && (
                  <TearHint text={OPEN_HINTS[shape]} />
                )}
              </div>

              <div className={play.shelf}>
                {ready && known && mustSignUp && (
                  <>
                    <p className={play.message}>{SIGN_UP_HINT}</p>
                    <ButtonLink href="/compte">Créer mon compte</ButtonLink>
                  </>
                )}
                {ready && known && !mustSignUp && (
                  <Button
                    className={play.openButton}
                    disabled={!canOpen || phase.name === "opening"}
                    onClick={() => {
                      startRequest();
                      playSound("tearFinish");
                      void openPack();
                    }}
                  >
                    {phase.name === "opening"
                      ? "Ouverture…"
                      : (stock?.action ?? "Ouvrir le sachet")}
                  </Button>
                )}
                {error !== null ? (
                  <p className={play.error} role="alert">
                    {error}
                  </p>
                ) : (
                  canOpen &&
                  guestLeft === 1 && <p className={play.message}>Dernier sachet sans compte.</p>
                )}
              </div>
            </section>
          </div>
          {catalog !== null && slipping !== null && (
            <SlippingWord catalog={catalog} cardId={slipping} />
          )}
        </>
      )}
    </main>
  );
}

/** Shown once a guest opened all its boosters. */
const SIGN_UP_HINT = "Crée ton compte pour garder tes cartes et ouvrir d'autres sachets.";

function PackView({ shape, ...props }: PackProps & { readonly shape: PackShape }) {
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
        backTone={pack.back}
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
            {last ? "Voir mon sachet" : "Suivante"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** What the sachet gave, and the level it raised. */
function Recap({
  catalog,
  pack,
  mustSignUp,
  onOpen,
}: {
  readonly catalog: Catalog | null;
  readonly pack: Pack;
  readonly mustSignUp: boolean;
  readonly onOpen: () => void;
}) {
  const view = usePlayerView();
  const { openCoffret } = useShell();
  const progressNow = useProgress();
  const progress = collectionProgress(pack.collectionCardIds, pack.quantitiesBefore, pack.cards);
  const xp = xpGainLabel(pack.progress);
  const levelUp = levelUpLabel(pack.progress);
  // The coffret replaces « open another » while it waits.
  const coffretWaits = pack.progress.levelUp && view.coffrets.length > 0;
  const canOpen = view.wallet !== null && (view.wallet.stored > 0 || view.wallet.bonus > 0);
  return (
    <div className={`${ui.panel} ${ui.pop} ${styles.recap}`}>
      <p className={ui.kicker}>Ton sachet</p>
      <RecapLine pack={pack} />
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
      {xp !== null && <p className={`${ui.display} ${styles.recapXp}`}>{xp}</p>}
      {progressNow !== null && (
        <XpBar ratio={levelRatio(progressNow)} className={styles.recapBar} />
      )}
      {levelUp !== null && (
        <p className={`${ui.pop} ${styles.levelUp}`}>
          {levelUp} {coffretWaits ? "Une récompense t'attend." : ""}
        </p>
      )}
      <p className={styles.recapProgress}>
        {pack.collectionName} · {progress.owned} / {progress.total}
        {progress.gained > 0 && <span className={styles.gained}> (+{progress.gained})</span>}
      </p>
      {mustSignUp && <p className={styles.hint}>{SIGN_UP_HINT}</p>}
      <div className={styles.actions}>
        {coffretWaits ? (
          <Button glow onClick={() => openCoffret()}>
            Ouvrir le coffret
          </Button>
        ) : mustSignUp ? (
          <ButtonLink href="/compte">Créer mon compte</ButtonLink>
        ) : (
          <Button disabled={!canOpen} onClick={onOpen}>
            {view.wallet === null || view.now === 0
              ? "Ouvrir un autre sachet"
              : openAgainLabel(view.wallet, view.now)}
          </Button>
        )}
        {mustSignUp && coffretWaits ? (
          <ButtonLink href="/compte" variant="secondary">
            Créer mon compte
          </ButtonLink>
        ) : (
          <Link href="/album" className={ui.secondary}>
            Voir mon album
          </Link>
        )}
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

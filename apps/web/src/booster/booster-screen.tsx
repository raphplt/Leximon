"use client";

import type { ProgressGain, RarityCompletionResponse } from "@leximon/contract";
import type { OpenBoosterResult } from "@leximon/contract/client";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import type { Rarity } from "@leximon/core";
import { cardSize, motion, rarityStyles } from "@leximon/tokens";
import type { PackShape } from "@leximon/view-model";
import {
  type CollectionChoice,
  collectionChoices,
  collectionProgress,
  copiesAt,
  type DrawnCard,
  firstOfRarityLabel,
  isFirstOfRarity,
  keepsAnnouncementWhenHurried,
  levelRatio,
  levelUpLabel,
  lockedToast,
  neighbourChoices,
  nextSachetLine,
  OPEN_HINTS,
  openAgainLabel,
  openButtonLabel,
  pickCollection,
  rarityCompletedLabel,
  recap,
  recapCascade,
  revealOrder,
  stagingFor,
  stockView,
  type WordMemory,
  wordUnderCounter,
  xpGainLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { loadCatalog } from "@/cards/catalog";
import { prepareSpokenWords } from "@/cards/use-spoken-word";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { api } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { CollectionPicker } from "@/play/collection-picker";
import { noteSachetOpened, StockDots, TearHint } from "@/play/counter-bits";
import { LevelStrip } from "@/play/level-strip";
import { PackPeek, PeekArrow } from "@/play/pack-peek";
import play from "@/play/play.module.css";
import { PlayFabs } from "@/play/play-fabs";
import { SlippingWord } from "@/play/slipping-word";
import {
  cardDates,
  noteGained,
  OWNED_CARDS_MAX_AGE_MS,
  ownedCards,
  wordMemory,
} from "@/player/collection";
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
import type { PackProps } from "./pack-shape";
import { Pli } from "./pli";
import { RevealCard } from "./reveal-card";
import { Sachet } from "./sachet";

/** Widest the recap's screen gets, in px: `.wide` in the stylesheet. */
const RECAP_SCREEN_MAX = 1180;
/** The screen's and the panel's padding around the recap's cards, in px. */
const RECAP_CHROME = 90;
const RECAP_GAP = 14;
/** Below this width a card's definition no longer reads: the recap turns into a carousel. */
const RECAP_CARD_MIN = 150;
const RECAP_CARD_MAX = 210;
/** Room left in the carousel for the next card to show at the edge, in px. */
const RECAP_PEEK = 96;
/**
 * Height a phone keeps around the carousel's cards, in px: top bar, tabs, the recap's lines and
 * its button. The cards shrink on a short screen so that the button shows without scrolling.
 */
const RECAP_PHONE_CHROME = 430;
/** The lines a recap shows only sometimes, in px: a level reached, an account to create. */
const RECAP_LEVEL_UP_LINE = 56;
const RECAP_SIGN_UP_LINE = 42;
const RECAP_COMPLETION_LINE = 32;
/** Narrower, a card no longer reads even as a preview. */
const RECAP_CAROUSEL_MIN = 180;
/** A skipped card chimes once it has landed, a little after its slot starts moving. */
const CHIME_AT_MS = 220;
/** Room left around a revealed card on a narrow phone, in px. */
const CARD_MARGIN = 56;
const CARD_MAX_WIDTH = 300;
/** The sachet chosen last, kept on the device. */
const CHOICE_KEY = "leximon.sachet";
/** Visits of the Jouer screen, kept on the device: the word under the counter changes with each. */
const VISITS_KEY = "leximon.visites";

type Phase =
  | { readonly name: "loading" }
  | { readonly name: "unavailable" }
  | { readonly name: "no_collection" }
  | { readonly name: "sealed" }
  | { readonly name: "opening" }
  | { readonly name: "stack" }
  | {
      readonly name: "revealing";
      readonly index: number;
      /** Where the player asked to reveal everything; null while turning cards one by one. */
      readonly hurriedFrom: number | null;
    }
  | { readonly name: "recap"; readonly hurriedFrom: number | null };

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
  /** Rarities of the collection this pack completed. */
  readonly completions: readonly RarityCompletionResponse[];
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

/** Counts this visit; 0 where the device keeps nothing, the word then staying the same. */
function countVisit(): number {
  try {
    const visit = (Number(window.localStorage.getItem(VISITS_KEY)) || 0) + 1;
    window.localStorage.setItem(VISITS_KEY, String(visit));
    return visit;
  } catch {
    return 0;
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
  /** What the player remembers of each word, for the word shown under the counter. */
  const [memory, setMemory] = useState<ReadonlyMap<string, WordMemory>>(new Map());
  const [visit, setVisit] = useState(0);
  const request = useRef<OpenRequest | null>(null);
  const { shape, known } = usePackShape();
  const view = usePlayerView();
  const who = useShared(account);
  const dates = useShared(cardDates);
  const toast = useToast();
  const cardWidth = useCardWidth();
  const { now } = view;
  const currentWallet = view.wallet;
  /** Boosters a guest may still open before creating an account; null for a member. */
  const guestLeft = who?.kind === "guest" ? who.boostersLeft : null;

  // Everything that sizes the counter is awaited together, so that it appears whole: nothing
  // arriving a moment later (the stock, the word under the counter) pushes the sachet around.
  const load = useCallback(async () => {
    try {
      const [loadedCatalog, copies, memories] = await Promise.all([
        loadCatalog(),
        ownedCards.read(OWNED_CARDS_MAX_AGE_MS),
        // Only a reminder: the counter goes without it rather than wait for it.
        wordMemory.read().catch(() => new Map<string, WordMemory>()),
        wallet.read(),
        account.read().catch(() => null),
      ]);
      setCatalog(loadedCatalog);
      setOwned(copies);
      setMemory(memories);
      setVisit(countVisit());
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
      outcome: api.openBooster(choice.source, current.key).then(
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
      completions: result.completions,
    });
    const after = new Map(owned);
    for (const card of result.cards) after.set(card.cardId, (after.get(card.cardId) ?? 0) + 1);
    setOwned(after);
    noteGained(
      result.cards.map((card) => card.cardId),
      owned,
    );
    ownedCards.publish(after);
    if (reduced) {
      setPhase({ name: "revealing", index: 0, hurriedFrom: null });
    } else {
      playSound("cardSlide");
      setPhase({ name: "stack" });
    }
  };

  const toRecap = (hurriedFrom: number | null) => {
    playSound("recap");
    setPhase({ name: "recap", hurriedFrom });
  };

  /** Next card, or, once the player asked to reveal everything, the next Épique or Légendaire. */
  const next = () => {
    if (phase.name !== "revealing" || pack === null) return;
    const from = phase.index + 1;
    const { hurriedFrom } = phase;
    const index =
      hurriedFrom !== null
        ? pack.cards.findIndex((card, i) => i >= from && keepsAnnouncementWhenHurried(card.rarity))
        : from < pack.cards.length
          ? from
          : -1;
    if (index === -1) toRecap(hurriedFrom);
    else setPhase({ name: "revealing", index, hurriedFrom });
  };

  const revealAll = () => {
    if (pack === null) return;
    const from = phase.name === "revealing" ? phase.index + 1 : 0;
    const index = pack.cards.findIndex(
      (card, i) => i >= from && keepsAnnouncementWhenHurried(card.rarity),
    );
    if (index === -1) toRecap(from);
    else setPhase({ name: "revealing", index, hurriedFrom: from });
  };

  const stock = currentWallet === null || now === 0 ? null : stockView(currentWallet, now);
  const mustSignUp = guestLeft === 0;
  // Bonus boosters are opened once the free stock is empty (the server decides which is spent).
  const canOpen = !mustSignUp && stock !== null && !stock.empty;

  /** What the arrow keys do: turn the sachets on the counter, nothing once a sachet is open. */
  const shiftRef = useRef<(side: "left" | "right") => void>(() => undefined);
  shiftRef.current = () => undefined;
  // The arrow keys turn the sachets too, unless a field or a dialog has them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const { target } = event;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]"))
        return;
      if (document.querySelector("dialog[open]") !== null) return;
      event.preventDefault();
      shiftRef.current(event.key === "ArrowLeft" ? "left" : "right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (phase.name === "stack" || phase.name === "revealing" || phase.name === "recap") {
    return (
      <main className={phase.name === "recap" ? `${styles.screen} ${styles.wide}` : styles.screen}>
        {phase.name === "stack" && pack !== null && (
          <div className={styles.center}>
            <CardStack
              cards={pack.cards}
              width={cardWidth}
              tone={pack.back}
              onReveal={() => {
                playSound("cardSlide");
                setPhase({ name: "revealing", index: 0, hurriedFrom: null });
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
            hurried={phase.hurriedFrom !== null}
            width={cardWidth}
            onNext={next}
            onRevealAll={revealAll}
          />
        )}
        {phase.name === "recap" && pack !== null && (
          <Recap
            catalog={catalog}
            pack={pack}
            hurriedFrom={phase.hurriedFrom}
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
  const underCounter =
    now === 0
      ? null
      : wordUnderCounter(memory, owned, (id) => dates?.get(id)?.read === false, now, visit);
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
  shiftRef.current = (side) => {
    const next = around[side];
    if (next === null || phase.name === "opening") return;
    if (next.lock !== null) onLocked();
    else pick(next, side);
  };
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
            <section className={play.counter} aria-label="Ton sachet">
              <div className={play.counterHead}>
                {choice !== null && (
                  <div className={play.counterTitle}>
                    <span className={play.counterName}>{choice.name}</span>
                    {choice.tagline !== null && (
                      <span className={play.counterTagline}>{choice.tagline}</span>
                    )}
                  </div>
                )}
                {choice !== null && (
                  <CollectionPicker
                    choices={choices}
                    current={choice}
                    onPick={pick}
                    onLocked={onLocked}
                  />
                )}
                {stock !== null && <StockDots stock={stock} />}
              </div>

              <div className={play.stage}>
                {phase.name === "unavailable" && (
                  <>
                    <p className={play.message}>Le serveur ne répond pas.</p>
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
                        // A guest out of sachets waits for an account, not for time.
                        refill={mustSignUp ? null : stock?.refill}
                        refillLabel={stock?.refillShort}
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
                    {around.left !== null && (
                      <PeekArrow
                        side="left"
                        choice={around.left}
                        onPick={pick}
                        onLocked={onLocked}
                      />
                    )}
                    {around.right !== null && (
                      <PeekArrow
                        side="right"
                        choice={around.right}
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
                      : stock === null
                        ? "Ouvrir le sachet"
                        : openButtonLabel(stock, guestLeft)}
                  </Button>
                )}
                {error !== null ? (
                  <p className={play.error} role="alert">
                    {error}
                  </p>
                ) : (
                  canOpen &&
                  guestLeft === 1 && (
                    <p className={play.message}>C'est ton dernier sachet sans compte.</p>
                  )
                )}
              </div>
            </section>
          </div>
          {catalog !== null && underCounter !== null && (
            <SlippingWord catalog={catalog} word={underCounter} />
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
            {last ? "Voir le bilan" : "Suivante"}
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
  hurriedFrom,
  mustSignUp,
  onOpen,
}: {
  readonly catalog: Catalog | null;
  readonly pack: Pack;
  readonly hurriedFrom: number | null;
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
  const nextSachet =
    view.wallet === null || view.now === 0 ? null : nextSachetLine(view.wallet, view.now);
  return (
    <div className={`${ui.panel} ${styles.recap}`}>
      <p className={`${ui.kicker} ${styles.recapKicker}`}>Ton sachet</p>
      <RecapLine pack={pack} />
      {catalog !== null && (
        <RecapCards
          catalog={catalog}
          pack={pack}
          hurriedFrom={hurriedFrom}
          extraLines={
            (levelUp === null ? 0 : RECAP_LEVEL_UP_LINE) +
            (mustSignUp ? RECAP_SIGN_UP_LINE : 0) +
            pack.completions.length * RECAP_COMPLETION_LINE
          }
        />
      )}
      {xp !== null && <p className={`${ui.display} ${styles.recapXp}`}>{xp}</p>}
      {pack.completions.map((completion) => (
        <p key={completion.rarity} className={`${ui.pop} ${styles.completed}`}>
          {rarityCompletedLabel(completion)}
        </p>
      ))}
      {progressNow !== null && (
        <XpBar ratio={levelRatio(progressNow)} className={styles.recapBar} />
      )}
      {levelUp !== null && <p className={`${ui.pop} ${styles.levelUp}`}>{levelUp}</p>}
      <p className={styles.recapProgress}>
        {pack.collectionName} · {progress.owned} / {progress.total}
        {progress.gained > 0 && <span className={styles.gained}> (+{progress.gained})</span>}
      </p>
      {mustSignUp && <p className={styles.hint}>{SIGN_UP_HINT}</p>}
      {!mustSignUp && !coffretWaits && nextSachet !== null && (
        <p className={styles.hint}>{nextSachet}</p>
      )}
      <div className={styles.actions}>
        {coffretWaits ? (
          <Button glow onClick={() => openCoffret()}>
            Ouvrir le coffret
          </Button>
        ) : mustSignUp ? (
          <ButtonLink href="/compte">Créer mon compte</ButtonLink>
        ) : (
          <Button onClick={onOpen}>
            {view.wallet === null ? "Ouvrir un autre sachet" : openAgainLabel(view.wallet)}
          </Button>
        )}
        {mustSignUp && coffretWaits ? (
          <ButtonLink href="/compte" variant="secondary">
            Créer mon compte
          </ButtonLink>
        ) : (
          <Link href="/album" className={`${ui.secondary} ${styles.recapAlbum}`}>
            Voir mon album
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * The pack's cards, large enough to be read, landing one after the other: in a row on a wide
 * screen, in a carousel on a phone. Touching one opens its sheet.
 */
function RecapCards({
  catalog,
  pack,
  hurriedFrom,
  extraLines,
}: {
  readonly catalog: Catalog;
  readonly pack: Pack;
  readonly hurriedFrom: number | null;
  /** Height of the lines shown under the cards this time, in px: the cards make room for them. */
  readonly extraLines: number;
}) {
  const { openCard } = useShell();
  const layout = useRecapLayout(pack.cards.length, extraLines);
  const [active, setActive] = useState(0);
  // Computed once: the cascade plays when the recap appears, not again on a resize.
  const [steps] = useState(() =>
    recapCascade(
      pack.cards,
      (index) => {
        const card = pack.cards[index];
        return (
          hurriedFrom === null ||
          index < hurriedFrom ||
          (card !== undefined && keepsAnnouncementWhenHurried(card.rarity))
        );
      },
      { reducedMotion: prefersReducedMotion() },
    ),
  );
  useEffect(() => {
    const timers = steps.flatMap((step) =>
      step.cue === null ? [] : [setTimeout(() => playSound(step.cue), step.delayMs + CHIME_AT_MS)],
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [steps]);

  const carousel = layout.mode === "carousel";
  return (
    <>
      <ul
        className={`${styles.recapCards} ${carousel ? styles.recapCarousel : styles.recapRow}`}
        style={{ "--w": `${layout.width}px`, "--gap": `${RECAP_GAP}px` } as CSSProperties}
        onScroll={
          carousel
            ? (event) =>
                setActive(Math.round(event.currentTarget.scrollLeft / (layout.width + RECAP_GAP)))
            : undefined
        }
      >
        {pack.cards.map((drawn, index) => {
          const card = cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity);
          const step = steps[index];
          const isNew =
            !pack.quantitiesBefore.has(drawn.cardId) &&
            pack.cards.findIndex((c) => c.cardId === drawn.cardId) === index;
          const look = rarityStyles[drawn.rarity];
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: a pack can hold the same card twice
              key={index}
              className={styles.recapSlot}
              style={
                {
                  "--delay": `${step?.delayMs ?? 0}ms`,
                  "--glint": look.glow ?? look.spot,
                } as CSSProperties
              }
            >
              <button
                type="button"
                className={`${styles.recapCard} ${step?.glint === true ? styles.glint : ""}`}
                onClick={() => openCard(drawn.cardId)}
                aria-label={`Lire ${card.word}`}
              >
                <Card card={card} collectionName={pack.collectionName} width={layout.width} />
              </button>
              {isNew && <span className={styles.recapNew}>Nouveau</span>}
            </li>
          );
        })}
      </ul>
      {carousel && (
        <p className={styles.dots} aria-hidden="true">
          {pack.cards.map((_, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a pack can hold the same card twice
              key={index}
              className={index === active ? styles.dotOn : styles.dot}
            />
          ))}
        </p>
      )}
      <p className={styles.recapHint}>Ouvre une carte pour la lire.</p>
    </>
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

interface RecapLayout {
  readonly mode: "row" | "carousel";
  /** Width of each card, in px. */
  readonly width: number;
}

/**
 * Cards side by side when each can still be read, otherwise one at a time, as wide as the
 * screen and its height allow.
 */
function recapLayout(
  windowWidth: number,
  windowHeight: number,
  count: number,
  extraLines: number,
): RecapLayout {
  const room = Math.min(windowWidth, RECAP_SCREEN_MAX) - RECAP_CHROME;
  const inRow = Math.floor((room - RECAP_GAP * (count - 1)) / count);
  if (inRow >= RECAP_CARD_MIN) return { mode: "row", width: Math.min(inRow, RECAP_CARD_MAX) };
  const cardHeight = windowHeight - RECAP_PHONE_CHROME - extraLines;
  const byHeight = (cardHeight * cardSize.width) / cardSize.height;
  const width = Math.min(CARD_MAX_WIDTH, windowWidth - RECAP_PEEK, byHeight);
  return { mode: "carousel", width: Math.floor(Math.max(RECAP_CAROUSEL_MIN, width)) };
}

function useRecapLayout(count: number, extraLines: number): RecapLayout {
  const [layout, setLayout] = useState(() =>
    recapLayout(window.innerWidth, window.innerHeight, count, extraLines),
  );
  useEffect(() => {
    const measure = () =>
      setLayout(recapLayout(window.innerWidth, window.innerHeight, count, extraLines));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [count, extraLines]);
  return layout;
}

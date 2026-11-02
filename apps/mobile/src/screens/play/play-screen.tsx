import type { OpenBoosterResult } from "@leximon/contract/client";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import type { Rarity } from "@leximon/core";
import { cardSize, effects, motion, openingTimes, rarityLights } from "@leximon/tokens";
import {
  type CollectionChoice,
  collectionChoices,
  collectionProgress,
  copiesAt,
  firstOfRarityLabel,
  isFirstOfRarity,
  keepsAnnouncementWhenHurried,
  lockedToast,
  neighbourChoices,
  openButtonLabel,
  pickCollection,
  revealNextLabel,
  revealOrder,
  type StockView,
  stagingFor,
  stockView,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router, useIsFocused } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { api } from "@/api/client";
import { loadCatalog } from "@/cards/catalog";
import { prepareSpokenWords } from "@/cards/spoken-word";
import { play, prepareSounds } from "@/feedback/feedback";
import { PaperAction } from "@/library/play-pieces";
import { noteGained, OWNED_CARDS_MAX_AGE_MS, ownedCards } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { account, publishProgress, wallet } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, IS_LIBRARY, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { RarityName } from "@/ui/rarity-icon";
import { ParticleStage, useOptionalStage } from "@/ui/stage";
import { CardStack } from "./card-stack";
import { type CounterMoment, LibraryCounter } from "./library-counter";
import { isNewAt, type Pack } from "./pack";
import { PlayFabs } from "./play-fabs";
import { Recap } from "./recap";
import { RevealCard } from "./reveal-card";
import { Sachet } from "./sachet";
import { noteSachetOpened, TearHint } from "./tear-hint";

/** The sachet chosen last, kept on the device. */
const CHOICE_KEY = "leximon_sachet";
const NOTICE_MS = 2600;
const SACHET_MAX_WIDTH = 230;
const CARD_MAX_WIDTH = 300;
/** Kept on both sides of the sachet for the round buttons. */
const FABS_ROOM = 150;
/** Room kept around a revealed card: the banner above, the bar below. */
const REVEAL_CHROME = 210;
const CHROME_FADE_MS = 160;

type Phase =
  | { readonly name: "loading" }
  | { readonly name: "unavailable" }
  | { readonly name: "no_collection" }
  | { readonly name: "sealed" }
  | { readonly name: "opening" }
  /** The cards out of the pack, face down, until the player touches them. */
  | { readonly name: "stack" }
  | {
      readonly name: "revealing";
      readonly index: number;
      /** Where the player asked to reveal everything; null while turning cards one by one. */
      readonly hurriedFrom: number | null;
    }
  | {
      readonly name: "recap";
      /** Where the player asked to reveal everything: the cards skipped chime in the recap. */
      readonly hurriedFrom: number | null;
    };

type Outcome =
  | { readonly kind: "answered"; readonly result: OpenBoosterResult }
  | { readonly kind: "failed" };

/** The request of the pack being opened, kept from the start of the tear to the server's answer. */
interface OpenRequest {
  readonly key: string;
  readonly outcome: Promise<Outcome> | null;
}

/** Shown once a guest opened all its boosters. */
const SIGN_UP_HINT = "Crée ton compte pour garder tes cartes et ouvrir d'autres sachets.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** In « La Bibliothèque », the seam of the sachet, from the top of its box: where light leaks. */
const SEAM_AT = 0.13;
/** Most sparks a single beat of the charge throws, however late the answer is. */
const CHARGE_SPARKS_MAX = 6;

/** The Jouer screen: the counter with its sachet, the opening, the reveal and the recap. */
export function PlayScreen() {
  return IS_LIBRARY ? (
    <ParticleStage dust>
      <PlayFlow />
    </ParticleStage>
  ) : (
    <PlayFlow />
  );
}

function PlayFlow() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [owned, setOwned] = useState<ReadonlyMap<string, number>>(new Map());
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wanted, setWanted] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Kept until the server answers, so that a retry never opens a second booster. */
  const request = useRef<OpenRequest | null>(null);
  const view = usePlayerView();
  const who = useShared(account);
  const now = useNow(15_000);
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const window = useWindowDimensions();
  const stage = useOptionalStage();
  const [moment, setMoment] = useState<CounterMoment>("waiting");
  const sachetRef = useRef<ViewInstance>(null);
  /** The whole screen, which sizes a revealed card. */
  const [screenHeight, setScreenHeight] = useState(0);
  /** The room left for the sachet between its picker and its shelf. */
  const [stageHeight, setStageHeight] = useState(0);
  const measureScreen = (event: LayoutChangeEvent) =>
    setScreenHeight(event.nativeEvent.layout.height);
  const currentWallet = view.wallet;
  /** Boosters a guest may still open before creating an account; null for a member. */
  const guestLeft = who?.kind === "guest" ? who.boostersLeft : null;

  // Everything the counter shows is awaited together, so that it appears whole.
  const load = useCallback(async () => {
    try {
      const [loadedCatalog, copies] = await Promise.all([
        loadCatalog(),
        ownedCards.read(OWNED_CARDS_MAX_AGE_MS),
        wallet.read(),
        account.read().catch(() => null),
      ]);
      setCatalog(loadedCatalog);
      setOwned(copies);
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
    SecureStore.getItemAsync(CHOICE_KEY).then(setWanted, () => undefined);
    void load();
    prepareSounds();
  }, [load]);

  // During the opening the sachet stays alone on a plain background.
  const opening = phase.name === "opening";
  const chrome = useSharedValue(1);
  useEffect(() => {
    const target = opening ? 0 : 1;
    chrome.value = reduced ? target : withTiming(target, { duration: CHROME_FADE_MS });
  }, [opening, reduced, chrome]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The stock refills on the server's schedule: ask again once the announced time has passed.
  const refillDue =
    currentWallet?.nextRefillAt != null && Date.parse(currentWallet.nextRefillAt) <= now;
  useEffect(() => {
    if (refillDue) wallet.refresh();
  }, [refillDue]);

  const level = view.progress?.level ?? 1;
  const choices = catalog === null ? [] : collectionChoices(catalog.collections, level, now);
  const choice = choices.length === 0 ? null : pickCollection(choices, wanted);

  const pick = (next: CollectionChoice) => {
    setWanted(next.id);
    SecureStore.setItemAsync(CHOICE_KEY, next.id).catch(() => undefined);
  };
  const onLocked = () => setNotice(lockedToast("choose_collection", now));

  /** Sends the request as soon as the tear begins: the server answers while the player tears. */
  const startRequest = (): OpenRequest | null => {
    if (choice === null) return null;
    const current = request.current ?? { key: randomUUID(), outcome: null };
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

  /** Runs `action` with the sachet's box, in window coordinates. */
  const atSachet = (action: (x: number, y: number, width: number, height: number) => void) => {
    sachetRef.current?.measureInWindow(action);
  };

  /**
   * The sachet comes to the middle, then charges until it is told to stop: sparks leak from its
   * seam, more of them as the wait goes on.
   */
  const chargeSachet = (): (() => void) => {
    setMoment("arriving");
    if (reduced || stage === null) {
      setMoment("charging");
      return () => undefined;
    }
    let beats = 0;
    let sparks: ReturnType<typeof setInterval> | undefined;
    const arrival = setTimeout(() => {
      setMoment("charging");
      sparks = setInterval(() => {
        beats++;
        const count = Math.min(CHARGE_SPARKS_MAX, 1 + Math.floor(beats / 4));
        atSachet((x, y, width, height) =>
          stage.burst(x + width / 2, y + height * SEAM_AT, { ...effects.charge.burst, count }),
        );
      }, effects.charge.everyMs);
    }, openingTimes.arriveMs);
    return () => {
      clearTimeout(arrival);
      clearInterval(sparks);
    };
  };

  /** The sachet bursts: light, a ring, scraps of parchment, and the screen shakes. */
  const burstSachet = () => {
    setMoment("burst");
    if (stage === null) return;
    atSachet((x, y, width, height) => {
      const middle = { x: x + width / 2, y: y + height / 2 };
      for (const settings of effects.burst) stage.burst(middle.x, middle.y, settings);
      stage.ring(middle.x, middle.y, rarityLights.epic[0] ?? colors.pageInk, 6);
      stage.flash(1, 500);
      stage.shake(10, 450);
    });
  };

  const openPack = async () => {
    if (catalog === null || choice === null) return;
    if (phase.name !== "sealed" && phase.name !== "recap") return;
    const started = startRequest();
    if (started?.outcome == null) return;
    setError(null);
    setPhase({ name: "opening" });
    const stopCharge = IS_LIBRARY ? chargeSachet() : () => undefined;
    // The words start loading while the seal still breaks.
    void started.outcome.then((answer) => {
      if (answer.kind !== "answered" || answer.result.kind !== "opened") return;
      prepareSpokenWords(
        answer.result.cards.flatMap((drawn) => catalog.cardsById.get(drawn.cardId) ?? []),
      );
    });
    const wait = reduced
      ? 0
      : IS_LIBRARY
        ? openingTimes.arriveMs + openingTimes.chargeMs
        : motion.sealBreak;
    const [outcome] = await Promise.all([started.outcome, delay(wait)]);
    stopCharge();
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
      onLocked();
      setPhase({ name: "sealed" });
      return;
    }
    if (IS_LIBRARY && !reduced) {
      burstSachet();
      await delay(openingTimes.burstMs);
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
    } else if (IS_LIBRARY) {
      // The cards come one by one straight from the burst, without the stack to touch first.
      play("cardSlide");
      setPhase({ name: "revealing", index: 0, hurriedFrom: null });
    } else {
      play("cardSlide");
      setPhase({ name: "stack" });
    }
  };

  const toRecap = (hurriedFrom: number | null) => {
    play("recap");
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
    if (pack === null || (phase.name !== "revealing" && phase.name !== "stack")) return;
    const from = phase.name === "revealing" ? phase.index + 1 : 0;
    const index = pack.cards.findIndex(
      (card, i) => i >= from && keepsAnnouncementWhenHurried(card.rarity),
    );
    if (index === -1) toRecap(from);
    else setPhase({ name: "revealing", index, hurriedFrom: from });
  };

  const stock = currentWallet === null ? null : stockView(currentWallet, now);
  const mustSignUp = guestLeft === 0;
  // Bonus boosters are opened once the free stock is empty (the server decides which is spent).
  const canOpen = !mustSignUp && stock !== null && !stock.empty;

  const revealWidth = Math.floor(
    Math.min(
      CARD_MAX_WIDTH,
      window.width - 56,
      ((screenHeight || window.height) - REVEAL_CHROME) * (cardSize.width / cardSize.height),
    ),
  );

  if (phase.name === "stack" && pack !== null) {
    return (
      <View style={styles.screen} onLayout={measureScreen}>
        <View style={styles.stackStage}>
          <CardStack
            cards={pack.cards}
            width={revealWidth}
            tone={pack.back}
            onReveal={() => {
              play("cardSlide");
              setPhase({ name: "revealing", index: 0, hurriedFrom: null });
            }}
          />
        </View>
        <View style={styles.revealBar}>
          <View style={styles.revealInfo}>
            <Text style={styles.position}>Touche la pile pour révéler tes mots</Text>
          </View>
          <View style={styles.revealActions}>
            <Pressable onPress={revealAll} accessibilityRole="button" style={styles.skip}>
              <Text style={styles.skipText}>Tout révéler</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (phase.name === "revealing" && pack !== null && catalog !== null) {
    const drawn = pack.cards[phase.index];
    if (drawn === undefined) return null;
    const card = cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity);
    const progress = collectionProgress(
      pack.collectionCardIds,
      pack.quantitiesBefore,
      pack.cards,
      phase.index,
    );
    const last = phase.index === pack.cards.length - 1;
    const hurried = phase.hurriedFrom !== null;
    return (
      <View style={styles.screen} onLayout={measureScreen}>
        <RevealCard
          key={phase.index}
          card={card}
          collectionName={collectionName(catalog, card.collectionId)}
          staging={stagingFor(drawn.rarity, { reducedMotion: reduced, hurried })}
          width={revealWidth}
          isNew={isNewAt(pack, phase.index)}
          copies={copiesAt(pack.cards, phase.index, pack.quantitiesBefore)}
          firstLabel={
            isFirstOfRarity(pack.cards, phase.index, pack.raritiesBefore)
              ? firstOfRarityLabel(drawn.rarity)
              : null
          }
          tone={pack.back}
          stage={stage}
          onNext={next}
        />
        <View style={styles.revealBar}>
          <View style={styles.revealInfo}>
            <RarityName rarity={drawn.rarity} color={colors.pageInk} />
            <Text style={styles.position}>
              {phase.index + 1} / {pack.cards.length} · {pack.collectionName} {progress.owned}/
              {progress.total}
            </Text>
          </View>
          {IS_LIBRARY ? (
            <View style={styles.revealActions}>
              {!last && !hurried && <PaperAction label="Tout révéler" onPress={revealAll} />}
              <PaperAction label={revealNextLabel(last)} onPress={next} />
            </View>
          ) : (
            <View style={styles.revealActions}>
              {!last && !hurried && (
                <Pressable onPress={revealAll} accessibilityRole="button" style={styles.skip}>
                  <Text style={styles.skipText}>Tout révéler</Text>
                </Pressable>
              )}
              <Pressable onPress={next} accessibilityRole="button" style={styles.next}>
                <Text style={styles.nextText}>{revealNextLabel(last)}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (phase.name === "recap" && pack !== null && catalog !== null) {
    return (
      <View style={styles.screen} onLayout={measureScreen}>
        <Recap
          catalog={catalog}
          pack={pack}
          hurriedFrom={phase.hurriedFrom}
          mustSignUp={mustSignUp}
          library={IS_LIBRARY}
          onOpenAnother={() => {
            setPack(null);
            play("tearFinish");
            void openPack();
          }}
          onHome={() => {
            setPack(null);
            setPhase({ name: "sealed" });
          }}
        />
      </View>
    );
  }

  const ready = phase.name === "sealed" || phase.name === "opening";
  const collection =
    choice === null ? null : (catalog?.collections.find((c) => c.id === choice.id) ?? null);
  if (IS_LIBRARY && ready && choice !== null && collection !== null) {
    const left =
      stock === null
        ? null
        : stock.stored > 0
          ? guestLeft === null
            ? stock.stored
            : Math.min(stock.stored, guestLeft)
          : stock.bonus;
    return (
      <View style={styles.screen} onLayout={measureScreen}>
        <LibraryCounter
          choices={choices}
          choice={choice}
          neighbours={neighbourChoices(choices, choice)}
          collection={collection}
          stock={stock}
          left={left}
          canOpen={canOpen}
          moment={opening ? moment : "waiting"}
          sachetRef={sachetRef}
          onPick={pick}
          onOpen={() => {
            if (!canOpen || opening) return;
            startRequest();
            play("tearFinish");
            void openPack();
          }}
          footer={
            mustSignUp ? (
              <>
                <Text style={styles.message}>{SIGN_UP_HINT}</Text>
                <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
              </>
            ) : error !== null ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : canOpen && guestLeft === 1 ? (
              <Text style={styles.message}>C'est ton dernier sachet sans compte.</Text>
            ) : null
          }
        />
      </View>
    );
  }
  const sachetWidth = Math.floor(
    Math.min(
      SACHET_MAX_WIDTH,
      window.width - FABS_ROOM,
      Math.max(0, stageHeight - 24) * (236 / 410),
    ),
  );
  return (
    <View style={styles.screen} onLayout={measureScreen}>
      {phase.name === "loading" ? (
        <Text style={styles.waiting}>On fouille les rayons…</Text>
      ) : (
        <View style={styles.counter}>
          <Animated.View style={chromeStyle}>
            {choice !== null && (
              <CollectionPicker
                choices={choices}
                current={choice}
                onPick={pick}
                onLocked={onLocked}
              />
            )}
            {stock !== null && <StockDots stock={stock} />}
          </Animated.View>
          <View
            style={styles.stage}
            onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
          >
            {phase.name === "unavailable" && (
              <>
                <Text style={styles.message}>Le serveur ne répond pas.</Text>
                <Button label="Réessayer" secondary onPress={() => void load()} />
              </>
            )}
            {phase.name === "no_collection" && (
              <Text style={styles.message}>Aucune collection n'est encore publiée.</Text>
            )}
            {ready && collection !== null && sachetWidth > 0 && (
              <Sachet
                key={collection.id}
                collection={collection}
                state={opening ? "opening" : canOpen ? "sealed" : "empty"}
                active={focused}
                width={sachetWidth}
                // A guest out of sachets waits for an account, not for time.
                refill={mustSignUp ? null : (stock?.refill ?? null)}
                refillLabel={stock?.refillShort ?? null}
                onTearStart={() => {
                  startRequest();
                }}
                onOpen={() => void openPack()}
              />
            )}
            {ready && (
              <Animated.View
                style={[StyleSheet.absoluteFill, chromeStyle]}
                pointerEvents={opening ? "none" : "box-none"}
              >
                <PlayFabs />
              </Animated.View>
            )}
            {notice !== null && (
              <Text style={styles.notice} accessibilityLiveRegion="polite">
                {notice}
              </Text>
            )}
          </View>
          <Animated.View style={[styles.shelf, chromeStyle]}>
            {phase.name === "sealed" && canOpen && <TearHint />}
            {ready && mustSignUp && (
              <>
                <Text style={styles.message}>{SIGN_UP_HINT}</Text>
                <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
              </>
            )}
            {ready && !mustSignUp && (
              <Button
                label={
                  opening
                    ? "Ouverture…"
                    : stock === null
                      ? "Ouvrir le sachet"
                      : openButtonLabel(stock, guestLeft)
                }
                disabled={!canOpen || opening}
                onPress={() => {
                  startRequest();
                  play("tearFinish");
                  void openPack();
                }}
              />
            )}
            {error !== null ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : (
              canOpen &&
              guestLeft === 1 && (
                <Text style={styles.message}>C'est ton dernier sachet sans compte.</Text>
              )
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/** Which sachet to open: arrows around its name through the open ones, a dot per collection. */
function CollectionPicker({
  choices,
  current,
  onPick,
  onLocked,
}: {
  readonly choices: readonly CollectionChoice[];
  readonly current: CollectionChoice;
  readonly onPick: (choice: CollectionChoice) => void;
  readonly onLocked: () => void;
}) {
  const open = choices.filter((c) => c.lock === null);
  const shift = (step: number) => {
    if (open.length < 2) {
      onLocked();
      return;
    }
    const index = open.findIndex((c) => c.id === current.id);
    const next = open[(index + step + open.length) % open.length];
    if (next !== undefined) onPick(next);
  };
  return (
    <View style={styles.picker}>
      <View style={styles.arrows}>
        <Pressable
          style={styles.round}
          onPress={() => shift(-1)}
          accessibilityRole="button"
          accessibilityLabel="Collection précédente"
        >
          <Icon name="back" size={18} color={colors.pageInk} />
        </Pressable>
        <View style={styles.pickerName} accessibilityLiveRegion="polite">
          <Text style={styles.kicker}>SACHET</Text>
          <Text style={styles.pickerTitle}>{current.short}</Text>
        </View>
        <Pressable
          style={styles.round}
          onPress={() => shift(1)}
          accessibilityRole="button"
          accessibilityLabel="Collection suivante"
        >
          <Icon name="chev" size={18} color={colors.pageInk} />
        </Pressable>
      </View>
      {choices.length > 1 && (
        <View style={styles.pickerDots}>
          {choices.map((choice) => (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityState={{ selected: choice.id === current.id }}
              accessibilityLabel={
                choice.lock === null
                  ? `Sachet ${choice.name}`
                  : `Sachet ${choice.name}, ${choice.lock.replace("Niv.", "niveau")}`
              }
              hitSlop={6}
              onPress={() => (choice.lock !== null ? onLocked() : onPick(choice))}
              style={[styles.pickerDot, choice.id === current.id && styles.pickerDotOn]}
            >
              {choice.lock !== null && <Icon name="lock" size={10} color={colors.pageInkMuted} />}
            </Pressable>
          ))}
        </View>
      )}
      {current.tagline !== null && <Text style={styles.tagline}>{current.tagline}</Text>}
    </View>
  );
}

/** The free stock as a row of dots, one per sachet it holds, with when the next one comes. */
function StockDots({ stock }: { readonly stock: StockView }) {
  return (
    <View style={styles.stock} accessible accessibilityLabel={stock.description}>
      <View style={styles.stockDots}>
        {Array.from({ length: stock.capacity }, (_, slot) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: a slot of the stock is its place.
            key={slot}
            style={[styles.stockDot, slot < stock.stored && styles.stockDotFull]}
          />
        ))}
      </View>
      <Text style={styles.stockNote}>{stock.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  waiting: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    color: colors.pageInkMuted,
  },
  counter: { flex: 1, paddingTop: space.s4 },
  picker: { alignItems: "center", gap: space.s4, paddingHorizontal: space.s10 },
  arrows: { flexDirection: "row", alignItems: "center", gap: space.s9 },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerName: { alignItems: "center", minWidth: 150 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 2,
    color: colors.pageInkMuted,
  },
  pickerTitle: { fontFamily: fonts.display, fontSize: fontSizes.titleLarge, color: colors.pageInk },
  pickerDots: { flexDirection: "row", gap: space.s5 },
  pickerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.rule,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerDotOn: { backgroundColor: colors.action, borderColor: colors.gilt },
  tagline: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 21,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
  stock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s5,
    marginTop: space.s5,
  },
  stockDots: { flexDirection: "row", gap: 5 },
  stockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.rule,
  },
  stockDotFull: { backgroundColor: colors.action, borderColor: colors.gilt },
  stockNote: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: colors.pageInkMuted },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.s7 },
  notice: {
    position: "absolute",
    bottom: 8,
    overflow: "hidden",
    paddingHorizontal: space.s8,
    paddingVertical: space.s5,
    borderRadius: radii.x3,
    backgroundColor: colors.sheet,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: colors.pageInk,
  },
  shelf: {
    gap: space.s4,
    paddingHorizontal: space.s12,
    paddingTop: space.s7,
    paddingBottom: 18 + TAB_BAR_RISE,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    borderStyle: "dashed",
    backgroundColor: colors.binding,
  },
  message: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
  error: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: colors.danger,
    textAlign: "center",
  },
  stackStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  revealBar: { paddingHorizontal: space.s10, paddingBottom: 12 + TAB_BAR_RISE, gap: space.s6 },
  revealInfo: { alignItems: "center", gap: space.s3 },
  position: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: colors.pageInkMuted,
  },
  revealActions: { flexDirection: "row", justifyContent: "center", gap: space.s6 },
  skip: {
    paddingHorizontal: space.s9,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.track,
    justifyContent: "center",
  },
  skipText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.pageInk },
  next: {
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.action,
    justifyContent: "center",
  },
  nextText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.actionInk },
});

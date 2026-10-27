import type { OpenBoosterResult } from "@leximon/contract/client";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import type { Rarity } from "@leximon/core";
import { cardSize, colors, motion } from "@leximon/tokens";
import {
  type CollectionChoice,
  collectionChoices,
  collectionProgress,
  copiesAt,
  firstOfRarityLabel,
  isFirstOfRarity,
  keepsAnnouncementWhenHurried,
  lockedToast,
  openButtonLabel,
  pickCollection,
  revealOrder,
  type StockView,
  stagingFor,
  stockView,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { api } from "@/api/client";
import { loadCatalog } from "@/cards/catalog";
import { prepareSpokenWords } from "@/cards/spoken-word";
import { play, prepareSounds } from "@/feedback/feedback";
import { noteGained, OWNED_CARDS_MAX_AGE_MS, ownedCards } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { account, publishProgress, wallet } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { RarityName } from "@/ui/rarity-icon";
import { CardStack } from "./card-stack";
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

/** The Jouer screen: the counter with its sachet, the opening, the reveal and the recap. */
export function PlayScreen() {
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
  const window = useWindowDimensions();
  const [stageHeight, setStageHeight] = useState(0);
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

  const openPack = async () => {
    if (catalog === null || choice === null || phase.name !== "sealed") return;
    const started = startRequest();
    if (started?.outcome == null) return;
    setError(null);
    setPhase({ name: "opening" });
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
      onLocked();
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
      ((stageHeight || window.height) - REVEAL_CHROME) * (cardSize.width / cardSize.height),
    ),
  );

  if (phase.name === "stack" && pack !== null) {
    return (
      <View
        style={styles.screen}
        onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
      >
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
      <View
        style={styles.screen}
        onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
      >
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
          onNext={next}
        />
        <View style={styles.revealBar}>
          <View style={styles.revealInfo}>
            <RarityName rarity={drawn.rarity} color={colors.text} />
            <Text style={styles.position}>
              {phase.index + 1} / {pack.cards.length} · {pack.collectionName} {progress.owned}/
              {progress.total}
            </Text>
          </View>
          <View style={styles.revealActions}>
            {!last && !hurried && (
              <Pressable onPress={revealAll} accessibilityRole="button" style={styles.skip}>
                <Text style={styles.skipText}>Tout révéler</Text>
              </Pressable>
            )}
            <Pressable onPress={next} accessibilityRole="button" style={styles.next}>
              <Text style={styles.nextText}>{last ? "Voir le bilan" : "Suivante"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (phase.name === "recap" && pack !== null && catalog !== null) {
    return (
      <View style={styles.screen}>
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
      </View>
    );
  }

  const ready = phase.name === "sealed" || phase.name === "opening";
  const collection =
    choice === null ? null : (catalog?.collections.find((c) => c.id === choice.id) ?? null);
  const sachetWidth = Math.floor(
    Math.min(
      SACHET_MAX_WIDTH,
      window.width - FABS_ROOM,
      Math.max(0, stageHeight - 24) * (236 / 410),
    ),
  );
  return (
    <View style={styles.screen}>
      {phase.name === "loading" ? (
        <Text style={styles.waiting}>On fouille les rayons…</Text>
      ) : (
        <View style={styles.counter}>
          {choice !== null && (
            <CollectionPicker
              choices={choices}
              current={choice}
              onPick={pick}
              onLocked={onLocked}
            />
          )}
          {stock !== null && <StockDots stock={stock} />}
          <View
            style={styles.stage}
            onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
          >
            {phase.name === "unavailable" && (
              <>
                <Text style={styles.message}>Le serveur lambine.</Text>
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
                state={phase.name === "opening" ? "opening" : canOpen ? "sealed" : "empty"}
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
            {ready && <PlayFabs />}
            {notice !== null && (
              <Text style={styles.notice} accessibilityLiveRegion="polite">
                {notice}
              </Text>
            )}
          </View>
          <View style={styles.shelf}>
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
                  phase.name === "opening"
                    ? "Ouverture…"
                    : stock === null
                      ? "Ouvrir le sachet"
                      : openButtonLabel(stock, guestLeft)
                }
                disabled={!canOpen || phase.name === "opening"}
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
          </View>
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
          <Icon name="back" size={18} color={colors.text} />
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
          <Icon name="chev" size={18} color={colors.text} />
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
              {choice.lock !== null && <Icon name="lock" size={10} color={colors.textMuted} />}
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
    fontSize: 17,
    color: colors.textMuted,
  },
  counter: { flex: 1, paddingTop: 8 },
  picker: { alignItems: "center", gap: 8, paddingHorizontal: 20 },
  arrows: { flexDirection: "row", alignItems: "center", gap: 18 },
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
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  pickerTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  pickerDots: { flexDirection: "row", gap: 10 },
  pickerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerDotOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tagline: {
    fontFamily: fonts.text.regular,
    fontSize: 16,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
  },
  stock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  stockDots: { flexDirection: "row", gap: 5 },
  stockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.outline,
  },
  stockDotFull: { backgroundColor: colors.accent, borderColor: colors.accent },
  stockNote: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.textMuted },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  notice: {
    position: "absolute",
    bottom: 8,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.sheet,
    fontFamily: fonts.ui.bold,
    fontSize: 14,
    color: colors.text,
  },
  shelf: {
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18 + TAB_BAR_RISE,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    borderStyle: "dashed",
    backgroundColor: colors.sunken,
  },
  message: {
    fontFamily: fonts.ui.medium,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  error: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.danger, textAlign: "center" },
  stackStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  revealBar: { paddingHorizontal: 20, paddingBottom: 12 + TAB_BAR_RISE, gap: 12 },
  revealInfo: { alignItems: "center", gap: 6 },
  position: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted },
  revealActions: { flexDirection: "row", justifyContent: "center", gap: 12 },
  skip: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.track,
    justifyContent: "center",
  },
  skipText: { fontFamily: fonts.ui.extrabold, fontSize: 15, color: colors.text },
  next: {
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: "center",
  },
  nextText: { fontFamily: fonts.ui.extrabold, fontSize: 15, color: colors.accentInk },
});

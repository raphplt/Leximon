import type { OpenBoosterResult } from "@leximon/contract/client";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import type { Rarity } from "@leximon/core";
import { cardSize, effects, openingTimes, rarityLights } from "@leximon/tokens";
import {
  type CollectionChoice,
  collectionChoices,
  collectionProgress,
  copiesAt,
  firstOfRarityLabel,
  GUEST_SIGN_UP_CTA,
  isFirstOfRarity,
  keepsAnnouncementWhenHurried,
  lockedToast,
  neighbourChoices,
  pickCollection,
  revealNextLabel,
  revealOrder,
  stagingFor,
  stockView,
  welcomeGuestLine,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router, useIsFocused } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { api } from "@/api/client";
import { loadCatalog } from "@/cards/catalog";
import { prepareSpokenWords } from "@/cards/spoken-word";
import { play, prepareSounds } from "@/feedback/feedback";
import { Desk, PaperAction } from "@/library/play-pieces";
import { noteGained, OWNED_CARDS_MAX_AGE_MS, ownedCards, refreshIfRead } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { account, carnet, missions, publishProgress, wallet } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { RarityName } from "@/ui/rarity-icon";
import { ParticleStage, useOptionalStage } from "@/ui/stage";
import { toast } from "@/ui/toast";
import { type CounterMoment, LibraryCounter } from "./library-counter";
import { isNewAt, type Pack } from "./pack";
import { Recap } from "./recap";
import { RevealCard } from "./reveal-card";
import { Sachet } from "./sachet";

/** The sachet chosen last, kept on the device. */
const CHOICE_KEY = "leximon_sachet";
const CARD_MAX_WIDTH = 300;
/**
 * Room kept around a revealed card: the banner above, the bar below, and under a new card the
 * line of its frequency, which takes two lines beside the buttons to hear it.
 */
const REVEAL_CHROME = 236;

type Phase =
  | { readonly name: "loading" }
  | { readonly name: "unavailable" }
  | { readonly name: "no_collection" }
  | { readonly name: "sealed" }
  | { readonly name: "opening" }
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

/** A wait for show only: `hurry` (a tap during the opening) cuts it short. */
function showFor(ms: number, hurry: { hurried: boolean; end: (() => void) | null }): Promise<void> {
  return new Promise((resolve) => {
    if (hurry.hurried) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      hurry.end = null;
      resolve();
    }
    hurry.end = done;
  });
}

/** The seam of the sachet, from the top of its box: where light leaks. */
const SEAM_AT = 0.13;
/** Most sparks a single beat of the charge throws, however late the answer is. */
const CHARGE_SPARKS_MAX = 6;

/** The Jouer screen: the counter with its sachet, the opening, the reveal and the recap. */
export function PlayScreen() {
  return (
    <ParticleStage dust>
      <PlayFlow />
    </ParticleStage>
  );
}

function PlayFlow() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [owned, setOwned] = useState<ReadonlyMap<string, number>>(new Map());
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wanted, setWanted] = useState<string | null>(null);
  /** Kept until the server answers, so that a retry never opens a second booster. */
  const request = useRef<OpenRequest | null>(null);
  const hurry = useRef<{ hurried: boolean; end: (() => void) | null }>({
    hurried: false,
    end: null,
  });
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

  const opening = phase.name === "opening";

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
  const onLocked = () => toast(lockedToast("choose_collection", now));

  /** Sends the request as soon as the tear begins: the server answers while the player tears. */
  const startRequest = (): OpenRequest | null => {
    if (choice === null) return null;
    const current = request.current ?? { key: randomUUID(), outcome: null };
    if (current.outcome !== null) return current;
    const started: OpenRequest = {
      key: current.key,
      outcome: api.openBooster(choice.source, current.key).then(
        (result): Outcome => {
          // A sachet opened moves a mission, and the first one of the day marks the carnet.
          refreshIfRead(missions);
          refreshIfRead(carnet);
          return { kind: "answered", result };
        },
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
    hurry.current = { hurried: false, end: null };
    setPhase({ name: "opening" });
    const stopCharge = chargeSachet();
    // The words start loading while the seal still breaks.
    void started.outcome.then((answer) => {
      if (answer.kind !== "answered" || answer.result.kind !== "opened") return;
      prepareSpokenWords(
        answer.result.cards.flatMap((drawn) => catalog.cardsById.get(drawn.cardId) ?? []),
      );
    });
    const wait = reduced ? 0 : openingTimes.arriveMs + openingTimes.chargeMs;
    const [outcome] = await Promise.all([started.outcome, showFor(wait, hurry.current)]);
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
    if (!reduced && !hurry.current.hurried) {
      burstSachet();
      await showFor(openingTimes.burstMs, hurry.current);
    }
    if (who?.kind === "guest") {
      account.publish({ ...who, boostersLeft: Math.max(0, who.boostersLeft - 1) });
    }
    const raritiesBefore = new Set<Rarity>();
    for (const id of owned.keys()) {
      const rarity = catalog.cardsById.get(id)?.rarity;
      if (rarity !== undefined) raritiesBefore.add(rarity);
    }
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
    // The cards come one by one straight from the burst.
    if (!reduced) play("cardSlide");
    setPhase({ name: "revealing", index: 0, hurriedFrom: null });
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
    if (pack === null || phase.name !== "revealing") return;
    const from = phase.index + 1;
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
        {/* On the desk, the lines under the card read on leather rather than on the shelves. */}
        <Desk style={styles.revealDesk} />
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
          <View style={styles.revealActions}>
            {!last && !hurried && <PaperAction label="Tout révéler" onPress={revealAll} />}
            <PaperAction label={revealNextLabel(last)} onPress={next} />
          </View>
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
  if (ready && choice !== null && collection !== null) {
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
          sachet={(width) => (
            <Sachet
              key={collection.id}
              collection={collection}
              state={
                opening ? (moment === "burst" ? "opening" : "sealed") : canOpen ? "sealed" : "empty"
              }
              active={focused && !opening}
              width={width}
              // A guest out of sachets waits for an account, not for time.
              refill={mustSignUp ? null : (stock?.refill ?? null)}
              refillLabel={stock?.refillShort ?? null}
              onTearStart={() => {
                startRequest();
              }}
              onOpen={() => {
                if (canOpen && !opening) void openPack();
              }}
            />
          )}
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
                {welcomeGuestLine(view.welcome) !== null && (
                  <Text style={styles.message}>{welcomeGuestLine(view.welcome)}</Text>
                )}
                <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
              </>
            ) : error !== null ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : guestLeft !== null ? (
              <>
                {canOpen && guestLeft === 1 && (
                  <Text style={styles.message}>C'est ton dernier sachet sans compte.</Text>
                )}
                <PaperAction label={GUEST_SIGN_UP_CTA} onPress={() => router.push("/compte")} />
              </>
            ) : null
          }
        />
        {opening && (
          // A tap during the opening goes straight to the cards, once the server has answered.
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Passer l'ouverture"
            onPress={() => {
              hurry.current.hurried = true;
              hurry.current.end?.();
            }}
          />
        )}
      </View>
    );
  }
  if (phase.name === "unavailable") {
    return (
      <Notice text="Le serveur ne répond pas.">
        <PaperAction label="Réessayer" onPress={() => void load()} />
      </Notice>
    );
  }
  if (phase.name === "no_collection")
    return <Notice text="Aucune collection n'est encore publiée." />;
  // Still loading, or no sachet chosen yet: the desk comes whole once it is.
  return (
    <View style={styles.screen} onLayout={measureScreen}>
      <Text style={styles.waiting}>On fouille les rayons…</Text>
    </View>
  );
}

/** Where the desk would be, a message on it instead of the sachet, and what to do about it. */
function Notice({ text, children }: { readonly text: string; readonly children?: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={styles.notice}>
        <Desk style={StyleSheet.absoluteFill} />
        <Text style={styles.hint}>{text}</Text>
        {children}
      </View>
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
  // On the desk, in the place of the sachet.
  notice: {
    position: "absolute",
    top: 26,
    left: 14,
    right: 14,
    bottom: 96 + TAB_BAR_RISE,
    alignItems: "center",
    justifyContent: "center",
    gap: space.s9,
    paddingHorizontal: 22,
  },
  hint: {
    maxWidth: 320,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInk,
    textAlign: "center",
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
  revealDesk: { position: "absolute", top: 4, left: 8, right: 8, bottom: TAB_BAR_RISE + 64 },
  revealBar: { paddingHorizontal: space.s10, paddingBottom: 12 + TAB_BAR_RISE, gap: space.s6 },
  revealInfo: { alignItems: "center", gap: space.s3 },
  position: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: colors.pageInkMuted,
  },
  revealActions: { flexDirection: "row", justifyContent: "center", gap: space.s6 },
});

import type { Catalog } from "@leximon/contract/client";
import type { ToyIconName, ToyMatterName } from "@leximon/tokens";
import {
  type CollectionChoice,
  dailyView,
  type FabId,
  type Fab as FabModel,
  lockedToast,
  NOT_BUILT_COPY,
  playFabs,
  type StockView,
  sachetContents,
} from "@leximon/view-model";
import { router } from "expo-router";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { catalogFileUrl } from "@/cards/catalog";
import { openCoffret } from "@/levels/coffret";
import { CollectionTitle, Desk, InfoBubble, MainAction, SideTile } from "@/library/play-pieces";
import { LibrarySachet, type LibrarySachetState } from "@/library/sachet";
import { dailyChallenge } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { usePlayerView } from "@/player/use-player-view";
import { TAB_BAR_RISE } from "@/shell/tab-bar";

type TileId = Exclude<FabId, "mail" | "settings">;

/** The band has the mail; the account page stands in for the settings. */
const TILES: Readonly<
  Record<TileId, { readonly icon: ToyIconName; readonly matter: ToyMatterName }>
> = {
  clan: { icon: "clan", matter: "blue" },
  chat: { icon: "discussion", matter: "green" },
  jousts: { icon: "jousts", matter: "red" },
  daily: { icon: "challenge", matter: "red" },
  friends: { icon: "friends", matter: "green" },
  coffrets: { icon: "chest", matter: "blue" },
};

/** How much the sachet grows once it comes to the middle to be opened. */
const OPENING_SCALE = 1.25;

/** Where the opening stands, as the counter shows it. */
export type CounterMoment = "waiting" | "arriving" | "charging" | "burst";

/**
 * The Jouer screen of « La Bibliothèque »: the collection's sachet on the desk under the lamp,
 * the tiles of the other places on both sides, and the gold button that opens it. While it
 * opens, everything but the sachet fades away and the sachet comes to the middle.
 */
export function LibraryCounter({
  choices,
  choice,
  neighbours,
  collection,
  stock,
  left,
  canOpen,
  moment,
  sachetRef,
  onPick,
  onOpen,
  footer,
}: {
  readonly choices: readonly CollectionChoice[];
  readonly choice: CollectionChoice;
  readonly neighbours: {
    readonly left: CollectionChoice | null;
    readonly right: CollectionChoice | null;
  };
  readonly collection: Catalog["collections"][number];
  readonly stock: StockView | null;
  /** Sachets the player may still open, for the count on the button; null to show none. */
  readonly left: number | null;
  readonly canOpen: boolean;
  readonly moment: CounterMoment;
  /** Where the particles of the opening start: the sachet. */
  readonly sachetRef: Ref<ViewInstance>;
  readonly onPick: (next: CollectionChoice) => void;
  readonly onOpen: () => void;
  /** Under the button: the account to create, an error, the last sachet without an account. */
  readonly footer: ReactNode;
}) {
  const now = useNow(60_000);
  const reduced = useReducedMotion();
  const [bubble, setBubble] = useState<{ readonly text: string } | null>(null);
  const say = (text: string) => setBubble({ text });
  const opening = moment !== "waiting";
  /** The room beside the tiles, and where the sachet lies in it: it climbs to its middle. */
  const [room, setRoom] = useState(0);
  const [place, setPlace] = useState({ y: 0, height: 0 });
  const climb = room === 0 ? 0 : room / 2 - place.y - place.height / 2;

  const chrome = useSharedValue(1);
  const lift = useSharedValue(0);
  useEffect(() => {
    chrome.value = reduced ? (opening ? 0 : 1) : withTiming(opening ? 0 : 1, { duration: 300 });
    lift.value = reduced
      ? opening
        ? 1
        : 0
      : opening
        ? withSpring(1, { damping: 12, stiffness: 140 })
        : withTiming(0, { duration: 200 });
  }, [opening, reduced, chrome, lift]);
  const fading = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const coming = useAnimatedStyle(() => ({
    transform: [
      { translateY: climb * lift.value },
      { scale: 1 + (OPENING_SCALE - 1) * lift.value },
    ],
  }));

  const turn = (side: "left" | "right") => {
    const next = neighbours[side];
    if (next === null || opening) return;
    if (next.lock !== null) say(lockedToast("choose_collection", now));
    else onPick(next);
  };
  const state: LibrarySachetState =
    moment === "charging"
      ? "charging"
      : moment === "burst"
        ? "burst"
        : canOpen
          ? "sealed"
          : "empty";
  const engraving = collection.engraving?.ink;

  return (
    <View style={styles.screen}>
      <Desk style={styles.desk} />
      <Animated.View style={fading} pointerEvents={opening ? "none" : "auto"}>
        <CollectionTitle
          kicker="Sachet"
          name={choice.name}
          tagline={choice.tagline ?? ""}
          index={Math.max(
            0,
            choices.findIndex((c) => c.id === choice.id),
          )}
          count={choices.length}
          previousLabel="Collection précédente"
          nextLabel="Collection suivante"
          onPrevious={() => turn("left")}
          onNext={() => turn("right")}
        />
      </Animated.View>
      <View
        style={styles.middle}
        onLayout={({ nativeEvent: { layout } }) => setRoom(layout.height)}
      >
        <Animated.View style={[styles.side, fading]} pointerEvents={opening ? "none" : "auto"}>
          <Tiles side="left" say={say} />
        </Animated.View>
        <Animated.View
          ref={sachetRef}
          style={[styles.sachet, coming]}
          onLayout={({ nativeEvent: { layout } }) =>
            setPlace({ y: layout.y, height: layout.height })
          }
        >
          <LibrarySachet
            key={collection.id}
            name={collection.name}
            back={collection.back}
            engraving={engraving === undefined ? undefined : catalogFileUrl(engraving)}
            label="Ouvrir le sachet"
            countLabel={sachetContents(now)}
            state={state}
            onOpen={onOpen}
          />
        </Animated.View>
        <Animated.View style={[styles.side, fading]} pointerEvents={opening ? "none" : "auto"}>
          <Tiles side="right" say={say} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.cta, fading]} pointerEvents={opening ? "none" : "auto"}>
        {stock !== null && (
          <MainAction
            label={opening ? "Ouverture…" : stock.action}
            count={left === null || left === 0 ? undefined : String(left)}
            disabled={!canOpen || opening}
            onPress={onOpen}
          />
        )}
        {footer}
      </Animated.View>
      <InfoBubble message={bubble} />
    </View>
  );
}

/** One column of tiles beside the sachet; a closed one says the level that opens it. */
function Tiles({
  side,
  say,
}: {
  readonly side: "left" | "right";
  readonly say: (text: string) => void;
}) {
  const view = usePlayerView();
  const now = useNow(60_000);
  const daily = useShared(dailyChallenge);
  const fabs = playFabs(
    { level: view.progress?.level ?? 1, coffrets: view.coffrets.length, mail: view.mail },
    now,
  )[side];
  const dailyLeft = daily !== null && dailyView(daily).ratio < 1;

  const act = (fab: FabModel) => {
    if (fab.lock !== null) {
      say(lockedToast(fab.id === "jousts" ? "jousts" : "join_clan", now));
      return;
    }
    switch (fab.id) {
      case "clan":
      case "chat":
        router.navigate("/clan");
        return;
      case "jousts":
        say(NOT_BUILT_COPY.jousts.title);
        return;
      case "daily":
        router.navigate("/defis");
        return;
      case "friends":
        router.push("/amis");
        return;
      case "coffrets":
        openCoffret();
        return;
      case "mail":
      case "settings":
        return;
    }
  };

  return (
    <>
      {fabs
        .filter(
          (fab): fab is FabModel & { id: TileId } => fab.id !== "mail" && fab.id !== "settings",
        )
        .map((fab) => (
          <SideTile
            key={fab.id}
            icon={TILES[fab.id].icon}
            matter={TILES[fab.id].matter}
            label={fab.label}
            badge={
              fab.badge > 0 ? String(fab.badge) : fab.id === "daily" && dailyLeft ? "!" : undefined
            }
            lockedAt={fab.lock ?? undefined}
            onPress={() => act(fab)}
          />
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", paddingTop: 46 },
  desk: { position: "absolute", top: 26, left: 14, right: 14, bottom: 96 + TAB_BAR_RISE },
  middle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginTop: 14,
  },
  side: { gap: 8, paddingTop: 10 },
  sachet: { marginHorizontal: -4, paddingTop: 12, zIndex: 2 },
  cta: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingBottom: 14 + TAB_BAR_RISE,
  },
});

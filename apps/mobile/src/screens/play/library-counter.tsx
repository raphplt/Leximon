import { openingTimes, type ToyIconName, type ToyMatterName, toyMatters } from "@leximon/tokens";
import {
  type CollectionChoice,
  dailyView,
  type FabId,
  type Fab as FabModel,
  lockedToast,
  missionsLockedToast,
  playFabs,
  type StockView,
} from "@leximon/view-model";
import { router } from "expo-router";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { openRewards } from "@/levels/welcome";
import { CollectionTitle, InfoBubble, MainAction, SideTile } from "@/library/play-pieces";
import { openMissions } from "@/missions/missions-sheet";
import { dailyChallenge } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { missions } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { GRID } from "./sachet-face";

type TileId = Exclude<FabId, "mail" | "settings">;

/** The band has the mail; the account page stands in for the settings. */
const TILES: Readonly<
  Record<TileId, { readonly icon: ToyIconName; readonly matter: ToyMatterName }>
> = {
  missions: { icon: "missions", matter: "gold" },
  clan: { icon: "clan", matter: "blue" },
  chat: { icon: "discussion", matter: "green" },
  jousts: { icon: "jousts", matter: "red" },
  daily: { icon: "challenge", matter: "red" },
  friends: { icon: "friends", matter: "green" },
  coffrets: { icon: "chest", matter: "blue" },
};

const COUNTER_TOP = 16;
const COUNTER_BOTTOM = 84 + TAB_BAR_RISE;

/** How much the sachet grows once it comes to the middle to be opened. */
const OPENING_SCALE = 1.25;
/** The sachet on the counter, between its tiles: as large as its row allows, within these. */
const SACHET_WIDTH = { min: 80, max: 250 } as const;
/** Room the sachet keeps in its row: its top margin and its sway. */
const SACHET_ROOM = 12;
/** Room it keeps across: breathing room between the side tiles and the sachet. */
const SACHET_GUTTER = 12;
/** Horizontal padding of the counter row, pushing the side tiles to the screen edges. */
const COUNTER_SIDE = 6;

/**
 * The sachet's width in a row of this height, between tiles leaving this much width: on a short
 * or narrow screen, it shrinks so the button and the tiles stay clear.
 */
function fitSachet(rowHeight: number, between: number): number {
  if (rowHeight === 0) return SACHET_WIDTH.max;
  const fit = Math.min(((rowHeight - SACHET_ROOM) * GRID.width) / GRID.height, between);
  return Math.max(SACHET_WIDTH.min, Math.min(SACHET_WIDTH.max, Math.floor(fit)));
}

/** How far a sachet slides across the desk when the collection changes, in pt. */
const SLIDE = 210;
const SLIDE_IN_WAIT_MS = 140;

/**
 * A change of sachet slides them across the desk, the new one in as the old one goes out. The new
 * one waits a moment before it moves: drawing it takes the phone's first frames, which would
 * otherwise swallow the start of its way in.
 */
function slideIn(from: "left" | "right") {
  const sign = from === "right" ? 1 : -1;
  return () => {
    "worklet";
    const go = <T extends number | string>(to: T) =>
      withDelay(
        SLIDE_IN_WAIT_MS,
        withTiming(to, { duration: 460, easing: Easing.out(Easing.quad) }),
      );
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateX: sign * SLIDE }, { rotate: `${sign * 10}deg` }],
      },
      animations: {
        opacity: go(1),
        transform: [{ translateX: go(0) }, { rotate: go("0deg") }],
      },
    };
  };
}

function slideOut(to: "left" | "right") {
  const sign = to === "right" ? 1 : -1;
  return () => {
    "worklet";
    const go = <T extends number | string>(value: T) =>
      withTiming(value, { duration: 380, easing: Easing.in(Easing.quad) });
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }, { rotate: "0deg" }] },
      animations: {
        opacity: go(0),
        transform: [{ translateX: go(sign * SLIDE) }, { rotate: go(`${sign * 10}deg`) }],
      },
    };
  };
}

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
  sachet,
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
  /**
   * The sachet itself at a width, which the screen opens: the counter only sizes it to its row,
   * moves it and makes it charge.
   */
  readonly sachet: (width: number) => ReactNode;
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
  /** The screen, the row of the tiles in it, and the sachet in that row: it climbs to the desk's middle. */
  const [screen, setScreen] = useState(0);
  const [row, setRow] = useState({ y: 0, height: 0 });
  const [place, setPlace] = useState({ y: 0, height: 0 });
  const deskMiddle = (COUNTER_TOP + screen - COUNTER_BOTTOM) / 2;
  const climb = screen === 0 ? 0 : deskMiddle - row.y - place.y - place.height / 2;
  /** The columns of tiles, at their natural size: they shrink to the row when it is short. */
  const [tiles, setTiles] = useState({ width: 0, height: 0 });
  const tileScale =
    row.height === 0 || tiles.height === 0 ? 1 : Math.min(1, row.height / tiles.height);
  const { width: windowWidth } = useWindowDimensions();
  const sachetWidth = fitSachet(
    row.height,
    windowWidth - 2 * COUNTER_SIDE - 2 * tiles.width * tileScale - SACHET_GUTTER,
  );
  const fitTiles = {
    transform: [{ scale: tileScale }],
    transformOrigin: "center",
  } as const;
  const measureTiles = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    setTiles((known) => ({
      width: Math.max(known.width, layout.width),
      height: Math.max(known.height, layout.height),
    }));

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

  // It trembles harder as the light gathers, then swells and is gone in the flash.
  const charge = useSharedValue(0);
  const wobble = useSharedValue(0.5);
  const vanish = useSharedValue(0);
  useEffect(() => {
    const charging = moment === "charging" && !reduced;
    charge.value = withTiming(moment === "charging" || moment === "burst" ? 1 : 0, {
      duration: moment === "charging" ? openingTimes.chargeMs : 200,
      easing: Easing.in(Easing.quad),
    });
    wobble.value = charging
      ? withRepeat(withTiming(1, { duration: 45 }), -1, true)
      : withTiming(0.5, { duration: 60 });
    vanish.value =
      moment === "burst" && !reduced
        ? withTiming(1, { duration: openingTimes.burstMs, easing: Easing.in(Easing.quad) })
        : 0;
  }, [moment, reduced, charge, wobble, vanish]);
  const trembling = useAnimatedStyle(() => {
    const shiver = (wobble.value * 2 - 1) * charge.value;
    return {
      opacity: 1 - Math.max(0, vanish.value - 0.4) / 0.6,
      transform: [
        { translateX: 3 * shiver },
        { rotate: `${1.8 * shiver}deg` },
        { scale: 1 + 0.2 * vanish.value },
      ],
    };
  });
  const glowing = useAnimatedStyle(() => ({
    opacity: charge.value * (1 - vanish.value),
    transform: [{ scale: 0.8 + 0.35 * charge.value }],
  }));

  /** The side the sachet on the desk came in from, on the last change. */
  const [entry, setEntry] = useState<"left" | "right" | null>(null);
  const turn = (side: "left" | "right") => {
    const next = neighbours[side];
    if (next === null || opening) return;
    if (next.lock !== null) say(lockedToast("choose_collection", now));
    else {
      setEntry(side);
      onPick(next);
    }
  };

  return (
    <View
      style={styles.screen}
      onLayout={({ nativeEvent: { layout } }) => setScreen(layout.height)}
    >
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
        onLayout={({ nativeEvent: { layout } }) => setRow({ y: layout.y, height: layout.height })}
      >
        <Animated.View
          style={[styles.side, fitTiles, fading]}
          pointerEvents={opening ? "none" : "auto"}
          onLayout={measureTiles}
        >
          <Tiles side="left" say={say} />
        </Animated.View>
        <Animated.View
          ref={sachetRef}
          style={[styles.sachet, coming]}
          onLayout={({ nativeEvent: { layout } }) =>
            setPlace({ y: layout.y, height: layout.height })
          }
        >
          <Animated.View style={[styles.glow, glowing]} pointerEvents="none" />
          <Animated.View style={trembling} pointerEvents={opening ? "none" : "auto"}>
            <Animated.View
              key={choice.id}
              collapsable={false}
              {...(entry === null
                ? {}
                : {
                    entering: slideIn(entry),
                    exiting: slideOut(entry === "right" ? "left" : "right"),
                  })}
            >
              {sachet(sachetWidth)}
            </Animated.View>
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={[styles.side, fitTiles, fading]}
          pointerEvents={opening ? "none" : "auto"}
          onLayout={measureTiles}
        >
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
  const today = useShared(missions);
  const fabs = playFabs(
    {
      level: view.progress?.level ?? 1,
      coffrets: view.rewardsWaiting,
      mail: view.mail,
      missions: (today?.claimable.missions ?? 0) + (today?.claimable.bonus ?? 0),
    },
    now,
  )[side];
  const dailyLeft = daily !== null && dailyView(daily).ratio < 1;

  const act = (fab: FabModel) => {
    if (fab.lock !== null) {
      say(
        fab.id === "missions"
          ? missionsLockedToast(now)
          : lockedToast(fab.id === "jousts" ? "jousts" : "join_clan", now),
      );
      return;
    }
    switch (fab.id) {
      case "missions":
        openMissions();
        return;
      case "clan":
      case "chat":
        router.navigate("/clan");
        return;
      case "jousts":
        router.push("/joutes");
        return;
      case "daily":
        router.navigate("/defis");
        return;
      case "friends":
        router.push("/amis");
        return;
      case "coffrets":
        openRewards();
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
            compact
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
  screen: { flex: 1, alignItems: "center", paddingTop: COUNTER_TOP },
  middle: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: COUNTER_SIDE,
    marginTop: 4,
  },
  side: { gap: 8 },
  sachet: { paddingTop: 2, zIndex: 2 },
  // The light it gathers, behind it.
  glow: {
    position: "absolute",
    top: "-20%",
    bottom: "-20%",
    left: "-40%",
    right: "-40%",
    backgroundImage: `radial-gradient(ellipse 50% 50% at 50% 50%, ${toyMatters.gold.top}8C, ${toyMatters.gold.bottom}26 60%, transparent)`,
  },
  cta: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 14 + TAB_BAR_RISE,
  },
});

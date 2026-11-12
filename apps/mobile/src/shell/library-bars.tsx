import type { ToyIconName } from "@leximon/tokens";
import {
  closedTabs,
  ECUS_TITLE,
  ecusLabel,
  levelBadge,
  levelDescription,
  levelRatio,
  levelsOfFeatures,
  mailLabel,
  PHONE_TAB_ORDER,
  stockView,
  TAB_LABELS,
  type TabId,
  tabBadge,
  xpProgressLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EcusSheet } from "@/ecus/ecus-sheet";
import {
  EcusButton,
  LevelGauge,
  MailButton,
  PortraitButton,
  StockButton,
  type Tab,
  TabBar,
} from "@/library/play-pieces";
import { useNow } from "@/player/shared";
import { usePlayerView } from "@/player/use-player-view";
import { Avatar } from "@/ui/avatar";
import { StockSheet } from "./stock-sheet";
import { TAB_ROUTES } from "./tab-bar";

const ICONS: Readonly<Record<Exclude<TabId, "jouer">, ToyIconName>> = {
  album: "album",
  defis: "challenges",
  echanges: "trades",
  clan: "community",
};

const SIDE_TABS = PHONE_TAB_ORDER.filter((id): id is Exclude<TabId, "jouer"> => id !== "jouer");

/** The band at the top of every tab: portrait, level, stock, mail. */
export function LibraryTopBand() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const view = usePlayerView();
  const now = useNow(15_000);
  const [stockOpen, setStockOpen] = useState(false);
  const [ecusOpen, setEcusOpen] = useState(false);
  const { progress } = view;
  const stock = view.wallet === null ? null : stockView(view.wallet, now);
  const narrow = window.width < 385;
  const tight = window.width < 365;
  return (
    <View style={[styles.band, narrow && styles.bandNarrow, { paddingTop: insets.top + 8 }]}>
      <PortraitButton label="Ton profil" compact={tight} onPress={() => router.push("/profil")}>
        <Avatar avatar={view.profile?.avatar ?? null} frame={null} size={tight ? 34 : 40} />
      </PortraitButton>
      <Pressable
        style={[styles.gauge, { minWidth: tight ? 42 : 46 }]}
        onPress={() => router.push("/niveaux")}
        accessibilityRole="button"
        accessibilityLabel={
          progress === null ? "Niveaux" : `Niveaux, ${levelDescription(progress)}`
        }
        hitSlop={8}
      >
        {progress !== null && (
          <LevelGauge
            level={progress.level}
            progress={levelRatio(progress)}
            label={xpProgressLabel(progress)}
            compact={tight}
          />
        )}
      </Pressable>
      {stock !== null && (
        <StockButton
          label={stock.description}
          figure={`${stock.stored}/${stock.capacity}`}
          compact={tight}
          onPress={() => setStockOpen(true)}
        />
      )}
      {view.wallet !== null && (
        <EcusButton
          label={`${ECUS_TITLE}, ${ecusLabel(view.wallet.ecus)}`}
          figure={String(view.wallet.ecus)}
          compact={tight}
          onPress={() => setEcusOpen(true)}
        />
      )}
      <MailButton
        label={mailLabel(view.mail)}
        count={view.mail}
        compact={tight}
        onPress={() => router.push("/courrier")}
      />
      {view.wallet !== null && (
        <StockSheet
          wallet={view.wallet}
          now={now}
          open={stockOpen}
          onClose={() => setStockOpen(false)}
        />
      )}
      {view.wallet !== null && (
        <EcusSheet
          wallet={view.wallet}
          now={now}
          open={ecusOpen}
          onClose={() => setEcusOpen(false)}
        />
      )}
    </View>
  );
}

/** The shelf of tabs: Jouer raised in gold, a padlock on what is closed. */
export function LibraryTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const view = usePlayerView();
  const now = useNow(60_000);
  const closed = closedTabs(view.progress?.level ?? null, now);
  const counts = { offers: view.offers, coffrets: view.coffrets.length, jousts: view.jousts };
  const currentRoute = state.routes[state.index]?.name;

  const go = (id: TabId) => {
    const route = state.routes.find((r) => r.name === TAB_ROUTES[id]);
    if (route === undefined) return;
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (currentRoute !== route.name && !event.defaultPrevented) navigateToTab(route.key);
  };

  const tabs = SIDE_TABS.map((id): Tab => {
    const badge = tabBadge(id, counts);
    return {
      icon: ICONS[id],
      label: TAB_LABELS[id],
      badge: badge > 0 ? String(badge) : undefined,
      lockedAt: closed.has(id) ? levelBadge(levelsOfFeatures(now).trade) : undefined,
    };
  });
  const [first, second, third, fourth] = tabs;
  if (first === undefined || second === undefined || third === undefined || fourth === undefined)
    return null;
  const sideIndex = SIDE_TABS.findIndex((id) => TAB_ROUTES[id] === currentRoute);
  return (
    <TabBar
      tabs={[first, second, third, fourth]}
      playLabel={TAB_LABELS.jouer}
      bottomInset={insets.bottom}
      current={currentRoute === TAB_ROUTES.jouer ? "play" : sideIndex === -1 ? null : sideIndex}
      onTab={(index) => {
        const id = SIDE_TABS[index];
        if (id !== undefined) go(id);
      }}
      onPlay={() => go("jouer")}
    />
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  bandNarrow: { gap: 4, paddingHorizontal: 8 },
  gauge: { flex: 1, minWidth: 46 },
});

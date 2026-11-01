import type { IconName } from "@leximon/tokens";
import { closedTabs, PHONE_TAB_ORDER, TAB_LABELS, type TabId, tabBadge } from "@leximon/view-model";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Stop, Circle as SvgCircle } from "react-native-svg";
import { useNow } from "@/player/shared";
import { usePlayerView } from "@/player/use-player-view";
import { alpha, colors, fontSizes, fonts, radii, space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Icon } from "@/ui/icon";
import { Matter } from "@/ui/matter";

/** The route of each tab in `app/(tabs)`. */
export const TAB_ROUTES: Readonly<Record<TabId, string>> = {
  jouer: "index",
  album: "album",
  defis: "defis",
  echanges: "echanges",
  clan: "clan",
};

const TAB_ICONS: Readonly<Record<TabId, IconName>> = {
  jouer: "sachet",
  album: "album",
  defis: "defi",
  echanges: "echange",
  clan: "clan",
};

const PLAY = 66;
const PLAY_LIFT = 34;

/** How far the raised Jouer button rises above the bar: what a screen keeps clear at its foot. */
export const TAB_BAR_RISE = PLAY_LIFT - 8 + 4;

/** Five tabs, Jouer raised in the middle; a padlock on what a level still closes. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const view = usePlayerView();
  const now = useNow(60_000);
  const closed = closedTabs(view.progress?.level ?? null, now);
  const current = state.routes[state.index]?.name;
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
      <Matter kind="leather" />
      {PHONE_TAB_ORDER.map((id) => {
        const route = state.routes.find((r) => r.name === TAB_ROUTES[id]);
        if (route === undefined) return null;
        const focused = current === route.name;
        const badge = tabBadge(id, { offers: view.offers, coffrets: view.coffrets.length });
        const color = focused ? colors.rubric : colors.bindingInkMuted;
        const onPress = () => {
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        const a11y = {
          accessibilityRole: "tab" as const,
          accessibilityState: { selected: focused },
          accessibilityLabel: closed.has(id) ? `${TAB_LABELS[id]}, verrouillé` : TAB_LABELS[id],
        };
        if (id === "jouer") {
          return (
            <Pressable key={id} style={[styles.tab, styles.play]} onPress={onPress} {...a11y}>
              <View style={styles.playCircle}>
                <Svg width={PLAY} height={PLAY} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <RadialGradient id="play" cx="35%" cy="30%" r="75%">
                      <Stop offset="0" stopColor={colors.actionLight} />
                      <Stop offset="0.55" stopColor={colors.rubric} />
                      <Stop offset="1" stopColor={colors.actionDeep} />
                    </RadialGradient>
                  </Defs>
                  <SvgCircle cx={PLAY / 2} cy={PLAY / 2} r={PLAY / 2} fill="url(#play)" />
                </Svg>
                <Icon name="sachet" size={30} color={colors.actionInk} />
                {badge > 0 && <Badge count={badge} ring={colors.bindingDeep} />}
              </View>
              <Text
                style={[styles.label, { color }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {TAB_LABELS[id]}
              </Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={id} style={styles.tab} onPress={onPress} {...a11y}>
            {/* Without a colour this view is flattened away, and Android brings it back square. */}
            <View collapsable={false} style={[styles.pill, focused && styles.pillFocused]}>
              <Icon name={TAB_ICONS[id]} size={22} color={color} />
              {closed.has(id) ? (
                <View style={styles.lock}>
                  <Icon name="lock" size={10} color={colors.pageInk} />
                </View>
              ) : (
                badge > 0 && <Badge count={badge} ring={colors.bindingDeep} />
              )}
            </View>
            <Text
              style={[styles.label, { color }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {TAB_LABELS[id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: space.s3,
    paddingTop: space.s4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.pageInk, 0.12),
    backgroundColor: colors.bindingDeep,
  },
  tab: { flex: 1, alignItems: "center", gap: space.s2 },
  // It rises above the bar without making the row taller: its label stays on the others' line.
  play: { marginTop: -PLAY_LIFT },
  playCircle: {
    width: PLAY + 10,
    height: PLAY + 10,
    borderRadius: radii.pill,
    borderWidth: 5,
    borderColor: colors.bindingDeep,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  pill: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pillFocused: { backgroundColor: alpha(colors.gilt, 0.16) },
  label: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.micro },
  lock: {
    position: "absolute",
    top: -4,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: radii.pill,
    backgroundColor: colors.rule,
    alignItems: "center",
    justifyContent: "center",
  },
});

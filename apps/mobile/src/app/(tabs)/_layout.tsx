import { PHONE_TAB_ORDER } from "@leximon/view-model";
import { useFocusEffect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SanctionHost } from "@/moderation/sanction-host";
import { NewsHost } from "@/screens/news/news-host";
import { TradeDoneMoment } from "@/screens/trades/trade-done";
import { TAB_ROUTES, TabBar } from "@/shell/tab-bar";
import { TopBar } from "@/shell/top-bar";
import { colors, SHOWS_THEME_CHOICE } from "@/theme";

// A link straight to a tab still leaves Jouer behind it, for the back button.
export const unstable_settings = { anchor: "index" };

export default function TabsLayout() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* In Le Livre the clock sits on the leather of the top bar, dark in both themes. */}
      {SHOWS_THEME_CHOICE && focused && <StatusBar style="light" />}
      <TopBar />
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        // Back from a tab returns to Jouer, and from Jouer leaves the app.
        backBehavior="initialRoute"
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.page },
          animation: "fade",
        }}
      >
        {PHONE_TAB_ORDER.map((id) => (
          <Tabs.Screen key={id} name={TAB_ROUTES[id]} />
        ))}
      </Tabs>
      <TradeDoneMoment />
      <SanctionHost />
      <NewsHost />
    </View>
  );
}

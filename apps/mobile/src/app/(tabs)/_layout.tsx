import { PHONE_TAB_ORDER } from "@leximon/view-model";
import { Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { Room } from "@/library/play-pieces";
import { SanctionHost } from "@/moderation/sanction-host";
import { NewsHost } from "@/screens/news/news-host";
import { TradeDoneMoment } from "@/screens/trades/trade-done";
import { LibraryTabBar, LibraryTopBand } from "@/shell/library-bars";
import { TAB_ROUTES, TabBar } from "@/shell/tab-bar";
import { TopBar } from "@/shell/top-bar";
import { colors, IS_LIBRARY } from "@/theme";

// A link straight to a tab still leaves Jouer behind it, for the back button.
export const unstable_settings = { anchor: "index" };

export default function TabsLayout() {
  if (IS_LIBRARY) {
    return (
      <Room>
        <LibraryTopBand />
        <Tabs
          tabBar={(props) => <LibraryTabBar {...props} />}
          backBehavior="initialRoute"
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: "transparent" },
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
      </Room>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
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

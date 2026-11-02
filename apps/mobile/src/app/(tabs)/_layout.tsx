import { PHONE_TAB_ORDER } from "@leximon/view-model";
import { Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { SanctionHost } from "@/moderation/sanction-host";
import { NewsHost } from "@/screens/news/news-host";
import { TradeDoneMoment } from "@/screens/trades/trade-done";
import { TAB_ROUTES, TabBar } from "@/shell/tab-bar";
import { TopBar } from "@/shell/top-bar";
import { colors } from "@/theme";

// A link straight to a tab still leaves Jouer behind it, for the back button.
export const unstable_settings = { anchor: "index" };

export default function TabsLayout() {
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

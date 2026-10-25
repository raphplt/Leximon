import { PHONE_TAB_ORDER } from "@leximon/view-model";
import { Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { TAB_ROUTES, TabBar } from "@/shell/tab-bar";
import { TopBar } from "@/shell/top-bar";
import { colors } from "@/theme";

// A link straight to a tab still leaves Jouer behind it, for the back button.
export const unstable_settings = { anchor: "index" };

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar />
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          animation: "fade",
        }}
      >
        {PHONE_TAB_ORDER.map((id) => (
          <Tabs.Screen key={id} name={TAB_ROUTES[id]} />
        ))}
      </Tabs>
    </View>
  );
}

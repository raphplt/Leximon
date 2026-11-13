import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MissingWordHost } from "@/ecus/missing-word";
import { RecycleHost } from "@/ecus/recycle-sheet";
import { CarnetHost } from "@/levels/carnet";
import { CoffretHost } from "@/levels/coffret";
import { WelcomeHost } from "@/levels/welcome";
import { MissionsHost } from "@/missions/missions-sheet";
import { useSessionGeneration } from "@/player/session";
import { UpdateGate } from "@/shell/update-gate";
import { colors } from "@/theme";
import { ToastHost } from "@/ui/toast";

export default function RootLayout() {
  // Another player: every screen mounts again and reads the new player's state.
  const generation = useSessionGeneration();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Fragment key={generation}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.page },
          }}
        />
        <CoffretHost />
        <WelcomeHost />
        <CarnetHost />
        <MissionsHost />
        <MissingWordHost />
        <RecycleHost />
      </Fragment>
      <ToastHost />
      <UpdateGate />
    </GestureHandlerRootView>
  );
}

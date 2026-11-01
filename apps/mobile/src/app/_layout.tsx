import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment } from "react";
import { CoffretHost } from "@/levels/coffret";
import { useSessionGeneration } from "@/player/session";
import { UpdateGate } from "@/shell/update-gate";
import { colors, theme } from "@/theme";
import { ToastHost } from "@/ui/toast";

export default function RootLayout() {
  // Another player: every screen mounts again and reads the new player's state.
  const generation = useSessionGeneration();
  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Fragment key={generation}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.page },
          }}
        />
        <CoffretHost />
      </Fragment>
      <ToastHost />
      <UpdateGate />
    </>
  );
}

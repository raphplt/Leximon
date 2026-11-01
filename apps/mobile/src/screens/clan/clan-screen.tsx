import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { myClan, profile, progress as progressResource } from "@/player/state";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { ClanPage } from "./clan-page";
import { FindClan } from "./find-clan";

/** Clan: the player's clan, or how to find one. `code` comes from an invitation link. */
export function ClanScreen({ code }: { readonly code: string | null }) {
  const mine = useShared(myClan);
  const progress = useShared(progressResource);
  const clanFailed = useSharedFailed(myClan);
  const now = useNow(30_000);
  // Kept for the code field, then out of the route.
  const [presetCode] = useState(code);
  useEffect(() => {
    if (code !== null) router.setParams({ code: undefined });
  }, [code]);

  // The clan just joined shows at once, while the player's clan is read again.
  const [joined, setJoined] = useState<string | null>(null);
  const onJoined = useCallback((clanId: string) => {
    setJoined(clanId);
    myClan.refresh();
    profile.refresh();
  }, []);
  const onLeft = useCallback(() => {
    setJoined(null);
    const current = myClan.current();
    if (current !== null) myClan.publish({ ...current, clanId: null, emblem: null });
    myClan.refresh();
    profile.refresh();
  }, []);

  if (mine === null && clanFailed) {
    return (
      <View style={styles.failed}>
        <Text style={styles.hint}>Impossible de charger ton clan.</Text>
        <Button label="Réessayer" secondary onPress={() => myClan.ensure()} />
      </View>
    );
  }
  if (mine === null || progress === null) return null;
  const clanId = mine.clanId ?? joined;
  if (clanId === null) {
    return (
      <FindClan
        mine={mine}
        level={progress.level}
        now={now}
        presetCode={presetCode}
        onJoined={onJoined}
      />
    );
  }
  return <ClanPage key={clanId} clanId={clanId} now={now} onLeft={onLeft} />;
}

const styles = StyleSheet.create({
  failed: { flex: 1, justifyContent: "center", gap: space.s8, paddingHorizontal: space.s12 },
  hint: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInk,
    textAlign: "center",
  },
});

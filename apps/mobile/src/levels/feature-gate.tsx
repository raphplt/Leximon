import type { IconName } from "@leximon/tokens";
import { type LockedFeature, lockedScreen } from "@leximon/view-model";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { progress as progressResource } from "@/player/state";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { LockedScreen } from "@/ui/locked-screen";

/** A screen opened by the level: the locked screen until the level, then `children`. */
export function FeatureGate({
  feature,
  icon,
  children,
}: {
  readonly feature: LockedFeature;
  readonly icon: IconName;
  readonly children: ReactNode;
}) {
  const progress = useShared(progressResource);
  const failed = useSharedFailed(progressResource);
  const now = useNow(60_000);
  if (progress === null) {
    return failed ? (
      <View style={styles.failed}>
        <Text style={styles.text}>Ton niveau ne se charge pas.</Text>
        <Button label="Réessayer" secondary onPress={() => progressResource.refresh()} />
      </View>
    ) : null;
  }
  const locked = lockedScreen(feature, progress, now);
  if (locked === null) return children;
  return (
    <LockedScreen
      icon={icon}
      level={locked.level}
      title={locked.title}
      text={locked.text}
      left={locked.left}
      ratio={locked.ratio}
    />
  );
}

const styles = StyleSheet.create({
  failed: { flex: 1, justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  text: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.text, textAlign: "center" },
});

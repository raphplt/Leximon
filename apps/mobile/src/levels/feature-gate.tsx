import type { IconName } from "@leximon/tokens";
import { type LockedFeature, lockedScreen } from "@leximon/view-model";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { progress as progressResource } from "@/player/state";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { LockedScreen } from "@/ui/locked-screen";

/**
 * A screen opened by the level: the locked screen until the level, then `children`. `above`
 * stays over the locked screen: the way to the rest of the place it belongs to.
 */
export function FeatureGate({
  feature,
  icon,
  above,
  children,
}: {
  readonly feature: LockedFeature;
  readonly icon: IconName;
  readonly above?: ReactNode;
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
      above={above}
    />
  );
}

const styles = StyleSheet.create({
  failed: { flex: 1, justifyContent: "center", gap: space.s8, paddingHorizontal: space.s12 },
  text: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInk,
    textAlign: "center",
  },
});

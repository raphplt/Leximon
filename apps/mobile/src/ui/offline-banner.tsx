import { useNetworkState } from "expo-network";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontSizes, fonts, radii, space } from "@/theme";

/** Discreet non-blocking banner shown when the device has no network connection. */
export function OfflineBanner() {
  const network = useNetworkState();
  const insets = useSafeAreaInsets();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View style={[styles.host, { top: insets.top + 6 }]} pointerEvents="none">
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <Text style={styles.text}>Hors connexion — tes cartes en cache restent lisibles</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 50 },
  banner: {
    paddingHorizontal: space.s8,
    paddingVertical: space.s3,
    borderRadius: radii.xxl,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  text: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.caption,
    color: colors.pageInkMuted,
  },
});
